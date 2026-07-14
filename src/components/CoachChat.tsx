"use client";

import { AnimatePresence, motion } from "framer-motion";
import { useEffect, useRef, useState } from "react";
import CoachAvatar from "./CoachAvatar";
import MoodPicker from "./MoodPicker";
import { success, tap } from "@/lib/haptics";
import { localCoachReply } from "@/lib/coach";
import { buildMemoryProfile, selectDailyPrompt } from "@/lib/prompts";
import { useApp } from "@/lib/store";
import { THEMES } from "@/lib/themes";
import { currentStreak } from "@/lib/streak";
import { CoachReply, todayKey } from "@/lib/types";

const VOICE_LIMIT_SECONDS = 60;
const TRANSCRIBE_TIMEOUT_MS = 25000;
const COACH_TIMEOUT_MS = 22000;
const THEME_UNLOCK_DAYS: Record<string, number> = {
  blossom: 0,
  twilight: 7,
  ocean: 14,
  forest: 21,
  sunrise: 30,
  mountain: 37,
  misty: 44,
  desert: 51,
  northern: 58,
  snowfall: 65,
  cloud: 72,
};

function growthNoticeFor(previousCount: number, nextCount: number) {
  const unlocked = [...THEMES]
    .sort((a, b) => (THEME_UNLOCK_DAYS[a.key] ?? 0) - (THEME_UNLOCK_DAYS[b.key] ?? 0))
    .find((theme) => previousCount < (THEME_UNLOCK_DAYS[theme.key] ?? 0) && nextCount >= (THEME_UNLOCK_DAYS[theme.key] ?? 0));
  return unlocked ? `${unlocked.label} unlocked. A new sanctuary is ready for you.` : "";
}

function inspirationFor(entry: string) {
  const lower = entry.toLowerCase();
  if (entry.trim().length < 8) {
    return "Start with one true sentence.";
  }
  if (/(tired|exhausted|drained|sleep|hard|rough|stress|bad)/.test(lower)) {
    return "A hard day still gave you something useful: a clear signal about what needs care.";
  }
  if (/(walk|run|workout|gym|exercise|outside)/.test(lower)) {
    return "You moved your body, and that is a practical kind of self-respect.";
  }
  if (/(work|meeting|client|project|job|business)/.test(lower)) {
    return "You showed up inside the real pressure of the day. That counts.";
  }
  if (/(family|friend|wife|husband|kid|daughter|son|mom|dad)/.test(lower)) {
    return "Connection showed up in your day. That is worth noticing.";
  }
  if (/(clean|cook|errand|laundry|home|fixed|organized)/.test(lower)) {
    return "The ordinary stuff is still care. You made life a little easier to live in.";
  }
  if (/(win|finished|done|progress|good|great|happy|proud)/.test(lower)) {
    return "Let the good part land for a second. You do not have to rush past it.";
  }
  return "There is something here you cared enough to name. That is a strong place to begin.";
}

export default function CoachChat({
  onCheckedIn,
  onNeedPremium,
  onReply,
  onViewJourney,
}: {
  onCheckedIn: () => void;
  onNeedPremium: () => void;
  onReply?: (text: string, reply: CoachReply) => void;
  onViewJourney?: () => void;
}) {
  const checkIns = useApp((s) => s.checkIns);
  const addCheckIn = useApp((s) => s.addCheckIn);
  const attachReply = useApp((s) => s.attachReply);
  const name = useApp((s) => s.settings.name);
  const premium = useApp((s) => s.settings.premium);
  const complimentaryAccess = useApp((s) => s.settings.complimentaryAccess);
  const sanctuaryTheme = useApp((s) => s.settings.theme);
  const moods = useApp((s) => s.moods);
  const coachNotes = useApp((s) => s.coachNotes);
  const addCoachNote = useApp((s) => s.addCoachNote);
  const canUseCoach = useApp((s) => s.canUseCoach);
  const recordCoachUse = useApp((s) => s.recordCoachUse);

  const [text, setText] = useState("");
  const [recording, setRecording] = useState(false);
  const [transcribing, setTranscribing] = useState(false);
  const [source, setSource] = useState<"voice" | "typed">("typed");
  const [showTranscriptPreview, setShowTranscriptPreview] = useState(false);
  const [captured, setCaptured] = useState(false);
  const [promptOffset, setPromptOffset] = useState(0);
  const [voiceElapsed, setVoiceElapsed] = useState(0);
  const [voiceSupported, setVoiceSupported] = useState(false);
  const [pendingId, setPendingId] = useState<string | null>(null);
  const [growthNotice, setGrowthNotice] = useState("");
  const [composerError, setComposerError] = useState("");
  const recorderRef = useRef<MediaRecorder | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const recognitionRef = useRef<any>(null);
  const chunksRef = useRef<BlobPart[]>([]);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const feedRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setVoiceSupported(
      typeof navigator.mediaDevices?.getUserMedia === "function" &&
        typeof window.MediaRecorder === "function"
    );
  }, []);

  useEffect(() => {
    if (!recording) {
      setVoiceElapsed(0);
      return;
    }

    setVoiceElapsed(0);
    const startedAt = Date.now();
    const interval = window.setInterval(() => {
      const elapsed = Math.min(
        VOICE_LIMIT_SECONDS,
        Math.floor((Date.now() - startedAt) / 1000)
      );
      setVoiceElapsed(elapsed);
      if (elapsed >= VOICE_LIMIT_SECONDS) stopVoice();
    }, 250);

    return () => window.clearInterval(interval);
  }, [recording]);

  const todays = checkIns.filter((c) => c.dateKey === todayKey());
  const latestToday = todays[0];
  const firstName = name.trim().split(/\s+/)[0];
  const promptSelection = selectDailyPrompt({
    checkIns,
    notes: coachNotes,
    sanctuaryTheme,
    mood: moods[todayKey()],
    streak: currentStreak(checkIns),
    offset: promptOffset,
  });
  const dailyPrompt = promptSelection.prompt;
  const promptReason = promptSelection.whyThisQuestion;
  const memoryProfile = buildMemoryProfile(checkIns, coachNotes, sanctuaryTheme);
  const composerStatus = composerError
    ? composerError
    : recording
      ? `Listening... ${voiceElapsed}s / ${VOICE_LIMIT_SECONDS}s`
      : transcribing
        ? "Transcribing your voice..."
        : pendingId
          ? "Building your insight..."
          : captured
            ? "Reflection captured."
            : text.trim()
              ? "Ready for insights."
              : "Ready when you are.";

  // Keep the newest exchange in view inside the feed (the page never scrolls)
  useEffect(() => {
    feedRef.current?.scrollTo({ top: 0, behavior: "smooth" });
  }, [todays.length, pendingId]);

  const submit = async () => {
    const entry = text.trim();
    if (!entry || pendingId) return;
    tap();
    setComposerError("");

    const needsWeekTwo =
      !premium &&
      complimentaryAccess &&
      (complimentaryAccess.status === "completed" || complimentaryAccess.status === "expired");
    if (needsWeekTwo) {
      setGrowthNotice("Your first week is complete. Ready for another one?");
      window.setTimeout(() => setGrowthNotice(""), 6500);
      onNeedPremium();
      return;
    }

    const allowed = canUseCoach();
    const notice = growthNoticeFor(checkIns.length, checkIns.length + 1);
    const checkIn = addCheckIn(entry, {
      source,
      prompt: dailyPrompt,
      promptType: promptSelection.promptType,
      promptWhy: promptSelection.whyThisQuestion,
    });
    if (notice) {
      setGrowthNotice(notice);
      window.setTimeout(() => setGrowthNotice(""), 4500);
    }
    setText("");
    setShowTranscriptPreview(false);
    setSource("typed");
    onCheckedIn();

    if (!allowed) {
      setGrowthNotice(
        "Your reflection has been saved. Begin Week Two when you are ready for more Tranqly insights."
      );
      window.setTimeout(() => setGrowthNotice(""), 6500);
      onNeedPremium();
      return;
    }

    recordCoachUse();
    setPendingId(checkIn.id);

    try {
      const controller = new AbortController();
      const timeout = window.setTimeout(() => controller.abort(), COACH_TIMEOUT_MS);
      const res = await fetch("/api/coach", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        signal: controller.signal,
        body: JSON.stringify({
          name,
          entry,
          mood: moods[todayKey()],
          streak: currentStreak([checkIn, ...checkIns]),
          learnedNotes: coachNotes,
          prompt: dailyPrompt,
          promptType: promptSelection.promptType,
          promptWhy: promptSelection.whyThisQuestion,
          memoryProfileSummary: memoryProfile.summaryLines,
          recentPromptHistory: checkIns
            .slice(0, 4)
            .map((c) => ({ prompt: c.prompt, promptType: c.promptType, promptWhy: c.promptWhy }))
            .filter((item) => item.prompt),
          recentHelpfulFeedback: JSON.parse(window.localStorage.getItem("tranqly-response-feedback") ?? "[]").slice(0, 5),
          currentSanctuary: sanctuaryTheme,
          userPlan: premium ? "plus" : "free",
          recentEntries: checkIns.slice(0, 5).map((c) => ({
            text: c.text,
            dateKey: c.dateKey,
            previousInsight: c.reply?.message,
            tags: c.reply?.tags ?? c.reply?.themes,
          })),
        }),
      });
      window.clearTimeout(timeout);
      const data = await res.json();
      const reply: CoachReply = data.fallback
        ? localCoachReply(entry, currentStreak([checkIn, ...checkIns]))
        : {
            message: data.message,
            nextStep: data.nextStep,
            title: data.title,
            preview: data.preview,
            nudgeLabel: data.nudgeLabel,
            pattern: data.pattern,
            summary: data.summary,
            themes: data.themes,
            tags: data.tags,
            emotionalTone: data.emotionalTone,
            followUpQuestions: data.followUpQuestions,
            source: "ai",
            createdAt: new Date().toISOString(),
          };
      attachReply(checkIn.id, reply);
      if (data.memoryNote) addCoachNote(data.memoryNote);
      success();
      onReply?.(text, reply);
    } catch {
      setComposerError("Insight took too long. Your reflection was saved, try again in a moment.");
      window.setTimeout(() => setComposerError(""), 5000);
      const errorReply = localCoachReply(entry, currentStreak([checkIn, ...checkIns]));
      attachReply(checkIn.id, errorReply);
      onReply?.(entry, errorReply);
    } finally {
      setPendingId(null);
    }
  };

  const stopVoice = () => {
    recorderRef.current?.stop();
    recognitionRef.current?.stop?.();
    recognitionRef.current = null;
    streamRef.current?.getTracks().forEach((track) => track.stop());
    streamRef.current = null;
    setRecording(false);
  };

  const voiceProgress = Math.min(1, voiceElapsed / VOICE_LIMIT_SECONDS);

  const voiceProgressBar = (
    <div className="mt-2 w-full max-w-[220px] short-fit:mt-1.5">
      <div className="h-1.5 overflow-hidden rounded-full bg-ink/80">
        <div
          className="h-full rounded-full bg-calm transition-[width] duration-300"
          style={{ width: `${voiceProgress * 100}%` }}
        />
      </div>
      <p className="mt-1 text-center text-[10px] font-bold text-faint">
        {voiceElapsed}s / {VOICE_LIMIT_SECONDS}s
      </p>
    </div>
  );

  const promptHeader = (
    <div className="mb-1.5 text-center">
      <p className="mx-auto mt-1 line-clamp-2 max-w-sm text-lg font-black leading-snug text-fg short-fit:text-base">
        {dailyPrompt}
      </p>
    </div>
  );

  const transcribeAudio = async (blob: Blob) => {
    if (!blob.size) return;
    setComposerError("");
    setTranscribing(true);
    try {
      const form = new FormData();
      form.append("audio", blob, "daily-check-in.webm");
      const controller = new AbortController();
      const timeout = window.setTimeout(() => controller.abort(), TRANSCRIBE_TIMEOUT_MS);
      const res = await fetch("/api/transcribe", {
        method: "POST",
        signal: controller.signal,
        body: form,
      });
      window.clearTimeout(timeout);
      if (!res.ok) {
        const data = (await res.json().catch(() => null)) as { error?: string } | null;
        throw new Error(data?.error ?? "Transcription failed");
      }
      const data = (await res.json()) as { text?: string };
      const transcript = data.text?.trim();
      if (transcript) {
        setText((current) =>
          current.toLowerCase().includes(transcript.toLowerCase())
            ? current
            : [current.trim(), transcript].filter(Boolean).join(" ")
        );
        setSource("voice");
        setShowTranscriptPreview(true);
        setCaptured(true);
        window.setTimeout(() => setCaptured(false), 500);
        success();
      } else {
        setComposerError("I could not hear enough audio. Try the mic again or type instead.");
        window.setTimeout(() => setComposerError(""), 5000);
      }
    } catch {
      setComposerError("Transcription failed. Try the mic again or type instead.");
      window.setTimeout(() => setComposerError(""), 5000);
      textareaRef.current?.focus();
    } finally {
      setTranscribing(false);
    }
  };

  const toggleVoice = async () => {
    tap();
    const needsWeekTwo =
      !premium &&
      complimentaryAccess &&
      (complimentaryAccess.status === "completed" || complimentaryAccess.status === "expired");
    if (needsWeekTwo) {
      setGrowthNotice("Your first week is complete. Ready for another one?");
      window.setTimeout(() => setGrowthNotice(""), 6500);
      onNeedPremium();
      return;
    }
    if (!voiceSupported) {
      textareaRef.current?.focus();
      return;
    }
    if (recording) {
      stopVoice();
      return;
    }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const recorder = new MediaRecorder(stream);
      chunksRef.current = [];
      streamRef.current = stream;
      recorderRef.current = recorder;
      recorder.ondataavailable = (event) => {
        if (event.data.size) chunksRef.current.push(event.data);
      };
      recorder.onstop = () => {
        const blob = new Blob(chunksRef.current, {
          type: recorder.mimeType || "audio/webm",
        });
        chunksRef.current = [];
        void transcribeAudio(blob);
      };
      const SpeechRecognition =
        (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
      if (SpeechRecognition) {
        const recognition = new SpeechRecognition();
        recognition.continuous = true;
        recognition.interimResults = true;
        recognition.onresult = (event: any) => {
          const liveText = Array.from(event.results)
            .map((result: any) => result[0]?.transcript ?? "")
            .join(" ")
            .trim();
          if (liveText) {
            setText(liveText);
            setSource("voice");
          }
        };
        recognition.onerror = () => undefined;
        recognition.start();
        recognitionRef.current = recognition;
      }
      recorder.start();
      setRecording(true);
      tap();
    } catch {
      setRecording(false);
      textareaRef.current?.focus();
    }
  };

  return (
    <>
      <AnimatePresence>
        {growthNotice ? (
          <motion.div
            initial={{ opacity: 0, y: -8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            className="mb-2 rounded-2xl border border-calm/25 bg-calm/10 px-3 py-2 text-sm font-semibold text-calm"
          >
            {growthNotice}
          </motion.div>
        ) : null}
      </AnimatePresence>
      {latestToday?.reply && !pendingId ? (
        <>
        <div className="flex min-h-0 flex-1 flex-col gap-2">
        <section className="flex min-h-0 flex-1 flex-col gap-2 rounded-xl2 border border-edge bg-card p-3 shadow-card short-fit:gap-1.5 short-fit:p-2.5">
          <p className="text-[11px] font-bold uppercase tracking-wide text-calm">
            Today's Insight
          </p>
          <motion.div
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            role="button"
            tabIndex={0}
            onClick={() => onReply?.(latestToday.text, latestToday.reply!)}
            onKeyDown={(event) => { if (event.key === "Enter" || event.key === " ") onReply?.(latestToday.text, latestToday.reply!); }}
            className="flex min-h-[142px] w-full min-w-0 max-w-full cursor-pointer flex-col overflow-hidden rounded-[2rem] border border-edge bg-ink/70 px-5 py-4 short-fit:min-h-[126px] short-fit:px-4 short-fit:py-3"
          >
            <h2 className="line-clamp-2 w-full min-w-0 max-w-full break-words text-lg font-black leading-tight tracking-tight short-fit:text-base">
              {latestToday.reply.title ?? "Today I noticed..."}
            </h2>
            <p className="mt-2 line-clamp-2 w-full min-w-0 max-w-full break-words text-sm leading-relaxed text-dim short-fit:mt-1">
              {latestToday.reply.preview ?? latestToday.reply.message}
            </p>
            <button
              onClick={() => onReply?.(latestToday.text, latestToday.reply!)}
              className="mt-auto min-h-[30px] self-start text-left text-xs font-black text-calm"
            >
              See more →
            </button>
          </motion.div>
          <div className="h-px bg-edge/70" />
          <p className="text-[11px] font-bold uppercase tracking-wide text-calm">
            Ask a follow-up
          </p>
            <div className="flex flex-col items-center gap-2 pt-5 short-fit:pt-3">
              {voiceSupported && (
                <>
                <motion.button
                  onClick={toggleVoice}
                  animate={{ scale: [1, 1.06, 1] }}
                  transition={{ duration: 1.5, repeat: Infinity, ease: "easeInOut" }}
                  className="flex h-[84px] w-[84px] shrink-0 items-center justify-center rounded-full bg-ink text-calm shadow-glow"
                  aria-label={recording ? "Stop listening" : "Speak your day"}
                >
                  <svg className="h-9 w-9" viewBox="0 0 24 24" fill="none">
                    <rect
                      x="9"
                      y="3"
                      width="6"
                      height="11"
                      rx="3"
                      stroke="currentColor"
                      strokeWidth="2"
                    />
                    <path
                      d="M5 11a7 7 0 0 0 14 0M12 18v3M8.5 21h7"
                      stroke="currentColor"
                      strokeWidth="2"
                      strokeLinecap="round"
                    />
                  </svg>
                </motion.button>
                {voiceProgressBar}
                </>
              )}
            <p className="text-center text-[11px] font-bold text-faint">
                {captured
                  ? "Reflection captured"
                  : recording
                    ? "I'm listening..."
                  : "Today's discovery"}
              </p>
              {promptHeader}
              <div className="w-full rounded-full border border-edge bg-ink/70 px-3 py-2">
                <p className={`text-center text-[11px] font-bold ${composerError ? "text-rose-300" : "text-calm"}`}>
                  {composerStatus}
                </p>
              </div>
              <textarea
                ref={textareaRef}
                value={text}
                onChange={(e) => setText(e.target.value)}
                placeholder={
                  transcribing
                    ? "Transcribing your voice..."
                    : "Ask Tranqly a follow-up, or add more for today."
                }
                rows={2}
                className="min-h-[86px] w-full resize-none rounded-2xl border border-edge bg-ink p-3 text-sm text-fg placeholder-faint outline-none focus:border-calm/60 short-fit:min-h-[78px]"
              />
            </div>
            <motion.button
              whileTap={{ scale: 0.97 }}
              onClick={submit}
              disabled={!text.trim() || pendingId !== null || transcribing}
              className="flex min-h-[42px] w-full items-center justify-center rounded-2xl border border-calm/20 bg-button text-sm font-bold text-fg shadow-glow disabled:border-edge disabled:bg-card disabled:text-dim disabled:shadow-none"
            >
              {pendingId ? "Getting insights..." : "Continue Conversation"}
            </motion.button>
        </section>
        {false && <motion.section
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          className="shrink-0 rounded-xl2 border border-edge bg-card p-3 shadow-card short-fit:p-2.5"
        >
          <p className="text-[11px] font-bold uppercase tracking-wide text-calm">
            Today's Insight
          </p>
          <h2 className="mt-1 text-lg font-black tracking-tight short-fit:text-base">
            {latestToday.reply?.title ?? "Today I noticed..."}
          </h2>
          <div className="mt-2 rounded-2xl border border-edge bg-ink/70 p-3">
            <p className="line-clamp-2 text-sm leading-relaxed text-dim">
              {latestToday.reply?.message}
            </p>
          </div>
          <button
            onClick={() => latestToday.reply && onReply?.(latestToday.text, latestToday.reply)}
            className="mt-2 text-left text-xs font-black text-calm"
          >
            See more →
          </button>
        </motion.section>}
        </div>
        </>
      ) : (
      <div className="flex min-h-0 flex-1 flex-col gap-2">
        <section className="shrink-0 rounded-xl2 border border-edge bg-card p-2.5 shadow-card short-fit:p-2">
          <div className="mb-1.5 text-center">
            {promptHeader}
            {promptReason && (
              <p className="mx-auto mt-1 max-w-xs text-xs leading-snug text-faint">
                {promptReason}
              </p>
            )}
            <button
              onClick={() => setPromptOffset((value) => value + 1)}
              className="mt-2 rounded-full border border-calm/20 bg-calm/10 px-3 py-1.5 text-xs font-black text-calm transition hover:bg-calm/15"
            >
              Refresh Prompt
            </button>
          </div>
          {voiceSupported && (
            <div className="mb-1.5 flex flex-col items-center gap-1">
              <div className="relative flex items-center justify-center">
                <motion.button
                  data-onboarding-target="mic"
                  whileTap={{ scale: 0.92 }}
                  animate={
                    recording
                      ? {
                          scale: [1, 1.08, 1],
                          transition: { duration: 1.2, repeat: Infinity },
                        }
                      : { scale: 1 }
                  }
                  onClick={toggleVoice}
                  className={`relative z-10 flex h-[96px] w-[96px] items-center justify-center rounded-full transition-colors short-fit:h-[84px] short-fit:w-[84px] shorter:h-[79px] shorter:w-[79px] shadow-glow ${
                    recording
                      ? "recording bg-calm/25 text-calm"
                      : "bg-ink text-calm"
                  }`}
                  aria-label={recording ? "Stop listening" : "Speak your day"}
                >
                  {recording ? (
                    <span className="flex items-end gap-1" aria-hidden>
                      {[10, 18, 14, 20, 12].map((h, i) => (
                        <motion.span
                          key={i}
                          className="w-1.5 rounded-full bg-calm"
                          animate={{ height: [h * 0.45, h, h * 0.55] }}
                          transition={{
                            duration: 0.55 + i * 0.08,
                            repeat: Infinity,
                            repeatType: "mirror",
                          }}
                          style={{ height: h }}
                        />
                      ))}
                    </span>
                  ) : (
                    <svg className="h-9 w-9 short-fit:h-8 short-fit:w-8" viewBox="0 0 24 24" fill="none">
                      <rect
                        x="9"
                        y="3"
                        width="6"
                        height="11"
                        rx="3"
                        stroke="currentColor"
                        strokeWidth="2"
                      />
                      <path
                        d="M5 11a7 7 0 0 0 14 0M12 18v3M8.5 21h7"
                        stroke="currentColor"
                        strokeWidth="2"
                        strokeLinecap="round"
                      />
                    </svg>
                  )}
                </motion.button>
              </div>
              {voiceProgressBar}
              <p className="text-xs font-medium text-faint short-fit:text-[11px]">
                {captured
                  ? "✓ Reflection captured"
                  : recording
                    ? "Speak naturally."
                  : transcribing
                    ? "Turning your voice into text..."
                    : "Tap the mic, or type below"}
              </p>
            </div>
          )}

          <div className="mb-2 rounded-full border border-edge bg-ink/70 px-3 py-2 short-fit:mb-1.5">
            <p className={`text-center text-[11px] font-bold short-fit:text-[10px] ${composerError ? "text-rose-300" : "text-calm"}`}>
              {composerStatus}
            </p>
          </div>

          {false && showTranscriptPreview && text.trim() && (
            <div className="mb-2 rounded-2xl border border-calm/25 bg-calm/10 p-3">
              <p className="text-[11px] font-bold uppercase tracking-wide text-calm">
                Here&apos;s what I heard
              </p>
              <p className="mt-1 text-sm italic leading-relaxed text-dim">
                &ldquo;{text.trim()}&rdquo;
              </p>
            </div>
          )}

          <textarea
            ref={textareaRef}
            value={text}
            onChange={(e) => setText(e.target.value)}
            placeholder={
              recording
                ? "Your thoughts will appear here..."
                : transcribing
                  ? "Transcribing your voice..."
                  : firstName
                    ? `${firstName}, what's on your mind today?`
                    : "What's on your mind today?"
            }
            rows={2}
            className="min-h-[96px] w-full resize-none rounded-2xl border border-edge bg-ink p-3 text-fg placeholder-faint outline-none focus:border-calm/60 short-fit:min-h-[82px] shorter:min-h-[76px] shorter:p-2 shorter:text-sm"
          />
        </section>

        {false && <div className="rounded-2xl border border-sea/20 bg-sea/10 px-3 py-1.5 short-fit:py-1">
          <p className="text-[11px] font-semibold uppercase tracking-wide text-sea">
            Need a little help?
          </p>
          <p className="mt-0.5 text-sm leading-snug text-dim short-fit:text-xs">
            {inspirationFor(text)}
          </p>
        </div>}

        <motion.button
          whileTap={{ scale: 0.97 }}
          onClick={submit}
          disabled={!text.trim() || pendingId !== null || transcribing || recording}
          initial={false}
          animate={{ opacity: recording || !text.trim() ? 0.55 : 1, y: recording || !text.trim() ? 6 : 0 }}
          className="flex min-h-[44px] w-full shrink-0 items-center justify-center rounded-2xl border border-calm/20 bg-button font-bold text-fg shadow-glow disabled:border-edge disabled:bg-card disabled:text-dim disabled:shadow-none short-fit:min-h-[40px] shorter:min-h-[38px] shorter:text-sm"
        >
          {pendingId ? "Getting insights..." : "Get Insights"}
        </motion.button>
      </div>
      )}

      {false ? (
    <div className="flex min-h-0 flex-1 flex-col gap-3 short-fit:gap-2 shorter:gap-1.5">
      {/* Composer, fixed height */}
      <section className="shrink-0 rounded-xl2 border border-edge bg-card p-4 shadow-card short-fit:p-3 shorter:p-2.5">
        {voiceSupported && (
          <div className="mb-3 flex flex-col items-center gap-1.5 short-fit:mb-2 short-fit:gap-1 shorter:mb-1 shorter:gap-0.5">
            <div className="relative flex items-center justify-center">
                <motion.button
                  whileTap={{ scale: 0.92 }}
                  animate={
                    recording
                      ? {
                          scale: [1, 1.08, 1],
                          transition: { duration: 1.2, repeat: Infinity },
                        }
                      : { scale: 1 }
                  }
                  onClick={toggleVoice}
                  className={`relative z-10 flex h-[72px] w-[72px] items-center justify-center rounded-full transition-colors short-fit:h-[58px] short-fit:w-[58px] shorter:h-[46px] shorter:w-[46px] shadow-glow ${
                    recording
                      ? "recording bg-calm/25 text-calm"
                      : "bg-ink text-calm"
                  }`}
                aria-label={recording ? "Stop listening" : "Speak your day"}
              >
                {recording ? (
                  <span className="flex items-end gap-1" aria-hidden>
                    {[10, 18, 14, 20, 12].map((h, i) => (
                      <motion.span
                        key={i}
                        className="w-1.5 rounded-full bg-calm"
                        animate={{ height: [h * 0.45, h, h * 0.55] }}
                        transition={{
                          duration: 0.55 + i * 0.08,
                          repeat: Infinity,
                          repeatType: "mirror",
                        }}
                        style={{ height: h }}
                      />
                    ))}
                  </span>
                ) : (
                  <svg className="h-8 w-8 short-fit:h-7 short-fit:w-7 shorter:h-6 shorter:w-6" viewBox="0 0 24 24" fill="none">
                    <rect
                      x="9"
                      y="3"
                      width="6"
                      height="11"
                      rx="3"
                      stroke="currentColor"
                      strokeWidth="2"
                    />
                    <path
                      d="M5 11a7 7 0 0 0 14 0M12 18v3"
                      stroke="currentColor"
                      strokeWidth="2"
                      strokeLinecap="round"
                    />
                  </svg>
                )}
              </motion.button>
            </div>
            <p className="text-xs font-medium text-faint short-fit:text-[11px] shorter:hidden">
              {recording
                ? "I'm listening... tap when you're done"
                : transcribing
                  ? "Turning your voice into text..."
                  : "Tap to speak, or type below"}
            </p>
          </div>
        )}

        <textarea
          ref={textareaRef}
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder={
            recording
              ? "Listening..."
              : transcribing
                ? "Transcribing your voice..."
                : "Big or small, whatever happened today. No judgment here."
          }
          rows={2}
          className="w-full resize-none rounded-2xl border border-edge bg-ink p-3 text-fg placeholder-faint outline-none focus:border-calm/60 short-fit:min-h-[62px] short-fit:p-3 shorter:min-h-[44px] shorter:p-2 shorter:text-sm"
        />

        <div className="mt-2 short-fit:mt-1.5 shorter:mt-1">
          <MoodPicker embedded />
        </div>

        <motion.button
          whileTap={{ scale: 0.97 }}
          onClick={submit}
          disabled={!text.trim() || pendingId !== null || transcribing}
          className="mt-3 flex min-h-[48px] w-full items-center justify-center gap-2 rounded-2xl border border-transparent bg-gradient-to-r from-calm to-sea font-bold text-ink shadow-glow disabled:border-edge disabled:from-card disabled:to-card disabled:text-dim disabled:shadow-none short-fit:mt-2 short-fit:min-h-[44px] shorter:mt-1.5 shorter:min-h-[38px] shorter:text-sm"
        >
          {pendingId ? "Getting insights..." : "Get Insights"}
        </motion.button>
      </section>

      {/* Conversation feed: absorbs all remaining height, scrolls inside itself */}
      <div
        ref={feedRef}
        className="no-scrollbar min-h-0 flex-1 overflow-y-auto pb-2"
      >
        {todays.length > 0 ? (
          <div className="flex flex-col gap-2.5">
            <AnimatePresence initial={false}>
              {todays.map((c) => (
                <motion.div
                  key={c.id}
                  layout
                  initial={{ opacity: 0, y: 16 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ type: "spring", stiffness: 300, damping: 28 }}
                  className="flex flex-col gap-2"
                >
                  {/* User bubble */}
                  <div className="ml-8 self-end rounded-2xl rounded-br-md bg-gradient-to-br from-calm/25 to-sea/15 px-4 py-2.5">
                    <p className="text-[15px] leading-relaxed short-fit:text-sm">
                      {c.text}
                    </p>
                  </div>

                  {pendingId === c.id ? (
                    <div className="mr-6 flex gap-2.5">
                      <span className="mt-1 shrink-0">
                        <CoachAvatar size={30} />
                      </span>
                      <div className="flex items-center gap-1.5 rounded-2xl rounded-tl-md border border-edge bg-card px-4 py-4">
                        <span className="typing-dot h-2 w-2 rounded-full bg-calm" />
                        <span className="typing-dot h-2 w-2 rounded-full bg-calm" />
                        <span className="typing-dot h-2 w-2 rounded-full bg-calm" />
                      </div>
                    </div>
                  ) : null}
                </motion.div>
              ))}
            </AnimatePresence>
          </div>
        ) : (
          <div className="flex flex-col gap-3">
            {text.trim().length > 0 ? (
              <div className="rounded-2xl border border-sea/20 bg-sea/10 px-3 py-2">
                <p className="text-[11px] font-semibold uppercase tracking-wide text-sea">
                  Based on this
                </p>
                <p className="mt-0.5 text-sm leading-snug text-dim short-fit:text-xs">
                  {inspirationFor(text)}
                </p>
              </div>
            ) : (
              <p className="px-4 pt-1 text-center text-sm leading-relaxed text-faint short-fit:text-xs">
                Whatever today looked like, it's worth reflecting on.
                <br />
                Tranqly is here. No judgment, ever. 💜
              </p>
            )}
          </div>
        )}
      </div>
    </div>
      ) : null}
    </>
  );
}
