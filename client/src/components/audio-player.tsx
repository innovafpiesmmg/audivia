import { useState, useRef, useEffect, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Slider } from "@/components/ui/slider";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import { 
  Play, 
  Pause, 
  Volume2, 
  VolumeX, 
  SkipBack, 
  SkipForward, 
  Clock, 
  Gauge,
  RotateCcw,
  RotateCw,
  Moon,
  Settings,
  ChevronUp,
  X
} from "lucide-react";
import type { Episode } from "@shared/schema";

interface AudioPlayerProps {
  episode: Episode;
  podcastTitle?: string;
  podcastCover?: string;
}

function formatTime(seconds: number): string {
  if (!seconds || isNaN(seconds)) return "0:00";
  const hours = Math.floor(seconds / 3600);
  const mins = Math.floor((seconds % 3600) / 60);
  const secs = Math.floor(seconds % 60);
  if (hours > 0) {
    return `${hours}:${mins.toString().padStart(2, "0")}:${secs.toString().padStart(2, "0")}`;
  }
  return `${mins}:${secs.toString().padStart(2, "0")}`;
}

function formatTimeRemaining(seconds: number): string {
  if (!seconds || isNaN(seconds)) return "-0:00";
  return `-${formatTime(seconds)}`;
}

const PLAYBACK_SPEEDS = [0.5, 0.75, 0.8, 1, 1.1, 1.25, 1.5, 1.75, 2, 2.5, 3];
const SKIP_AMOUNTS = [10, 15, 30];
const SLEEP_TIMER_OPTIONS = [
  { label: "5 minutos", value: 5 * 60 },
  { label: "10 minutos", value: 10 * 60 },
  { label: "15 minutos", value: 15 * 60 },
  { label: "30 minutos", value: 30 * 60 },
  { label: "45 minutos", value: 45 * 60 },
  { label: "1 hora", value: 60 * 60 },
  { label: "Final del capítulo", value: -1 },
];

export function AudioPlayer({ episode, podcastTitle, podcastCover }: AudioPlayerProps) {
  const audioRef = useRef<HTMLAudioElement>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [volume, setVolume] = useState(1);
  const [isMuted, setIsMuted] = useState(false);
  const [playbackRate, setPlaybackRate] = useState(1);
  const [skipAmount, setSkipAmount] = useState(15);
  const [jumpDialogOpen, setJumpDialogOpen] = useState(false);
  const [jumpMinutes, setJumpMinutes] = useState("");
  const [jumpSeconds, setJumpSeconds] = useState("");
  const [showTimeRemaining, setShowTimeRemaining] = useState(false);
  const [sleepTimer, setSleepTimer] = useState<number | null>(null);
  const [sleepTimerRemaining, setSleepTimerRemaining] = useState<number | null>(null);
  const [mobileControlsOpen, setMobileControlsOpen] = useState(false);
  const listenedThresholdReached = useRef(false);
  const sleepTimerInterval = useRef<NodeJS.Timeout | null>(null);

  // Mark episode as listened when 80% is reached
  useEffect(() => {
    if (duration > 0 && currentTime / duration >= 0.8 && !listenedThresholdReached.current) {
      listenedThresholdReached.current = true;
      try {
        const data = localStorage.getItem("listened-episodes");
        const listened: string[] = data ? JSON.parse(data) : [];
        if (!listened.includes(episode.id)) {
          listened.push(episode.id);
          localStorage.setItem("listened-episodes", JSON.stringify(listened));
          window.dispatchEvent(new CustomEvent("episode-listened", { detail: { episodeId: episode.id } }));
        }
      } catch (error) {
        console.error("Error saving listened episode:", error);
      }
    }
  }, [currentTime, duration, episode.id]);

  // Reset threshold when episode changes
  useEffect(() => {
    listenedThresholdReached.current = false;
  }, [episode.id]);

  // Audio event listeners
  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;

    const updateTime = () => setCurrentTime(audio.currentTime);
    const updateDuration = () => setDuration(audio.duration);
    const handleEnded = () => {
      setIsPlaying(false);
      if (sleepTimer === -1) {
        cancelSleepTimer();
      }
    };

    audio.addEventListener("timeupdate", updateTime);
    audio.addEventListener("loadedmetadata", updateDuration);
    audio.addEventListener("ended", handleEnded);

    return () => {
      audio.removeEventListener("timeupdate", updateTime);
      audio.removeEventListener("loadedmetadata", updateDuration);
      audio.removeEventListener("ended", handleEnded);
    };
  }, [sleepTimer]);

  // Sleep timer logic
  useEffect(() => {
    if (sleepTimerRemaining !== null && sleepTimerRemaining > 0 && isPlaying) {
      sleepTimerInterval.current = setInterval(() => {
        setSleepTimerRemaining(prev => {
          if (prev === null || prev <= 1) {
            if (audioRef.current) {
              audioRef.current.pause();
              setIsPlaying(false);
            }
            cancelSleepTimer();
            return null;
          }
          return prev - 1;
        });
      }, 1000);
    }

    return () => {
      if (sleepTimerInterval.current) {
        clearInterval(sleepTimerInterval.current);
      }
    };
  }, [sleepTimerRemaining, isPlaying]);

  const cancelSleepTimer = useCallback(() => {
    setSleepTimer(null);
    setSleepTimerRemaining(null);
    if (sleepTimerInterval.current) {
      clearInterval(sleepTimerInterval.current);
    }
  }, []);

  const startSleepTimer = useCallback((seconds: number) => {
    if (seconds === -1) {
      setSleepTimer(-1);
      setSleepTimerRemaining(null);
    } else {
      setSleepTimer(seconds);
      setSleepTimerRemaining(seconds);
    }
  }, []);

  const togglePlay = () => {
    if (audioRef.current) {
      if (isPlaying) {
        audioRef.current.pause();
      } else {
        audioRef.current.play();
      }
      setIsPlaying(!isPlaying);
    }
  };

  const handleSeek = (value: number[]) => {
    if (audioRef.current) {
      audioRef.current.currentTime = value[0];
      setCurrentTime(value[0]);
    }
  };

  const handleVolumeChange = (value: number[]) => {
    const newVolume = value[0];
    setVolume(newVolume);
    if (audioRef.current) {
      audioRef.current.volume = newVolume;
    }
    if (newVolume > 0 && isMuted) {
      setIsMuted(false);
    }
  };

  const toggleMute = () => {
    if (audioRef.current) {
      audioRef.current.muted = !isMuted;
      setIsMuted(!isMuted);
    }
  };

  const skipForward = () => {
    if (audioRef.current) {
      const newTime = Math.min(audioRef.current.currentTime + skipAmount, duration);
      audioRef.current.currentTime = newTime;
      setCurrentTime(newTime);
    }
  };

  const skipBackward = () => {
    if (audioRef.current) {
      const newTime = Math.max(audioRef.current.currentTime - skipAmount, 0);
      audioRef.current.currentTime = newTime;
      setCurrentTime(newTime);
    }
  };

  const changePlaybackRate = (rate: number) => {
    setPlaybackRate(rate);
    if (audioRef.current) {
      audioRef.current.playbackRate = rate;
    }
  };

  const handleJumpToTime = () => {
    const mins = parseInt(jumpMinutes) || 0;
    const secs = parseInt(jumpSeconds) || 0;
    const totalSeconds = (mins * 60) + secs;
    
    if (audioRef.current && totalSeconds >= 0 && totalSeconds <= duration) {
      audioRef.current.currentTime = totalSeconds;
      setCurrentTime(totalSeconds);
      setJumpDialogOpen(false);
      setJumpMinutes("");
      setJumpSeconds("");
    }
  };

  const progress = duration > 0 ? (currentTime / duration) * 100 : 0;
  const timeRemaining = duration - currentTime;

  return (
    <div className="fixed bottom-0 left-0 right-0 bg-card border-t border-card-border z-50">
      <div className="max-w-7xl mx-auto px-4 py-3">
        <audio ref={audioRef} src={episode.audioUrl || undefined} data-testid="audio-player" />

        {/* Progress Bar */}
        <div className="mb-3">
          <Slider
            value={[currentTime]}
            max={duration || 100}
            step={0.1}
            onValueChange={handleSeek}
            className="cursor-pointer"
            data-testid="slider-progress"
          />
          <div className="flex justify-between text-xs text-muted-foreground mt-1">
            <span data-testid="text-current-time">{formatTime(currentTime)}</span>
            <button 
              onClick={() => setShowTimeRemaining(!showTimeRemaining)}
              className="hover:text-foreground transition-colors"
              data-testid="button-toggle-time-display"
            >
              {showTimeRemaining 
                ? formatTimeRemaining(timeRemaining)
                : formatTime(duration)
              }
            </button>
          </div>
        </div>

        {/* Controls */}
        <div className="flex items-center gap-4">
          {/* Cover & Info */}
          <div className="flex items-center gap-3 flex-1 min-w-0">
            {podcastCover && (
              <img
                src={podcastCover}
                alt={podcastTitle || "Audiobook"}
                className="w-12 h-12 rounded-lg object-cover flex-shrink-0"
              />
            )}
            <div className="min-w-0 flex-1">
              <p className="font-semibold text-sm line-clamp-1" data-testid="text-player-episode-title">
                {episode.title}
              </p>
              {podcastTitle && (
                <p className="text-xs text-muted-foreground line-clamp-1">
                  {podcastTitle}
                </p>
              )}
              {sleepTimer !== null && (
                <p className="text-xs text-primary flex items-center gap-1">
                  <Moon className="h-3 w-3" />
                  {sleepTimer === -1 
                    ? "Hasta final del capítulo" 
                    : sleepTimerRemaining 
                      ? `Apagar en ${formatTime(sleepTimerRemaining)}`
                      : null
                  }
                </p>
              )}
            </div>
          </div>

          {/* Playback Controls */}
          <div className="flex items-center gap-1 flex-shrink-0">
            {/* Skip Backward */}
            <Button
              variant="ghost"
              size="icon"
              onClick={skipBackward}
              className="relative"
              data-testid="button-skip-backward"
              title={`Retroceder ${skipAmount}s`}
            >
              <RotateCcw className="h-5 w-5" />
              <span className="absolute text-[9px] font-bold">{skipAmount}</span>
            </Button>

            {/* Play/Pause */}
            <Button
              variant="default"
              size="icon"
              onClick={togglePlay}
              className="h-12 w-12 rounded-full"
              data-testid="button-play-pause"
            >
              {isPlaying ? (
                <Pause className="h-5 w-5 fill-current" />
              ) : (
                <Play className="h-5 w-5 fill-current ml-0.5" />
              )}
            </Button>

            {/* Skip Forward */}
            <Button
              variant="ghost"
              size="icon"
              onClick={skipForward}
              className="relative"
              data-testid="button-skip-forward"
              title={`Avanzar ${skipAmount}s`}
            >
              <RotateCw className="h-5 w-5" />
              <span className="absolute text-[9px] font-bold">{skipAmount}</span>
            </Button>
          </div>

          {/* Advanced Controls - Desktop */}
          <div className="hidden md:flex items-center gap-2 flex-shrink-0">
            {/* Playback Speed */}
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="sm" className="h-8 px-2 gap-1 min-w-[60px]" data-testid="button-playback-speed">
                  <Gauge className="h-3 w-3" />
                  <span className="text-xs font-medium">{playbackRate}x</span>
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="max-h-64 overflow-y-auto">
                {PLAYBACK_SPEEDS.map(speed => (
                  <DropdownMenuItem 
                    key={speed}
                    onClick={() => changePlaybackRate(speed)} 
                    className={playbackRate === speed ? "bg-accent" : ""}
                    data-testid={`menu-speed-${speed}`}
                  >
                    {speed === 1 ? "Normal (1x)" : `${speed}x`}
                  </DropdownMenuItem>
                ))}
              </DropdownMenuContent>
            </DropdownMenu>

            {/* Skip Amount Selector */}
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="sm" className="h-8 px-2 gap-1" data-testid="button-skip-amount">
                  <SkipForward className="h-3 w-3" />
                  <span className="text-xs">{skipAmount}s</span>
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                {SKIP_AMOUNTS.map(amount => (
                  <DropdownMenuItem 
                    key={amount}
                    onClick={() => setSkipAmount(amount)}
                    className={skipAmount === amount ? "bg-accent" : ""}
                    data-testid={`menu-skip-${amount}`}
                  >
                    {amount} segundos
                  </DropdownMenuItem>
                ))}
              </DropdownMenuContent>
            </DropdownMenu>

            {/* Sleep Timer */}
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button 
                  variant="ghost" 
                  size="icon" 
                  className={`h-8 w-8 ${sleepTimer !== null ? "text-primary" : ""}`}
                  data-testid="button-sleep-timer"
                  title="Temporizador de sueño"
                >
                  <Moon className="h-4 w-4" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                {sleepTimer !== null && (
                  <>
                    <DropdownMenuItem onClick={cancelSleepTimer} className="text-destructive" data-testid="menu-cancel-sleep">
                      <X className="h-4 w-4 mr-2" />
                      Cancelar temporizador
                    </DropdownMenuItem>
                    <DropdownMenuSeparator />
                  </>
                )}
                {SLEEP_TIMER_OPTIONS.map(option => (
                  <DropdownMenuItem 
                    key={option.value}
                    onClick={() => startSleepTimer(option.value)}
                    data-testid={`menu-sleep-${option.value}`}
                  >
                    {option.label}
                  </DropdownMenuItem>
                ))}
              </DropdownMenuContent>
            </DropdownMenu>

            {/* Jump to Time */}
            <Dialog open={jumpDialogOpen} onOpenChange={setJumpDialogOpen}>
              <DialogTrigger asChild>
                <Button variant="ghost" size="icon" className="h-8 w-8" data-testid="button-jump-to-time" title="Ir a minuto específico">
                  <Clock className="h-4 w-4" />
                </Button>
              </DialogTrigger>
              <DialogContent className="sm:max-w-md">
                <DialogHeader>
                  <DialogTitle>Ir a Tiempo Específico</DialogTitle>
                  <DialogDescription>
                    Introduce el tiempo al que deseas saltar
                  </DialogDescription>
                </DialogHeader>
                <div className="flex gap-4 py-4">
                  <div className="flex-1">
                    <Label htmlFor="jump-minutes" className="text-sm mb-2 block">
                      Minutos
                    </Label>
                    <Input
                      id="jump-minutes"
                      type="number"
                      min="0"
                      max={Math.floor(duration / 60)}
                      value={jumpMinutes}
                      onChange={(e) => setJumpMinutes(e.target.value)}
                      placeholder="0"
                      data-testid="input-jump-minutes"
                    />
                  </div>
                  <div className="flex-1">
                    <Label htmlFor="jump-seconds" className="text-sm mb-2 block">
                      Segundos
                    </Label>
                    <Input
                      id="jump-seconds"
                      type="number"
                      min="0"
                      max="59"
                      value={jumpSeconds}
                      onChange={(e) => setJumpSeconds(e.target.value)}
                      placeholder="0"
                      data-testid="input-jump-seconds"
                    />
                  </div>
                </div>
                <div className="flex justify-end gap-2">
                  <Button variant="outline" onClick={() => setJumpDialogOpen(false)} data-testid="button-cancel-jump">
                    Cancelar
                  </Button>
                  <Button onClick={handleJumpToTime} data-testid="button-confirm-jump">
                    Ir
                  </Button>
                </div>
              </DialogContent>
            </Dialog>
          </div>

          {/* Volume Controls - Desktop */}
          <div className="hidden md:flex items-center gap-2 w-32 flex-shrink-0">
            <Button
              variant="ghost"
              size="icon"
              onClick={toggleMute}
              className="h-8 w-8"
              data-testid="button-mute"
            >
              {isMuted || volume === 0 ? (
                <VolumeX className="h-4 w-4" />
              ) : (
                <Volume2 className="h-4 w-4" />
              )}
            </Button>
            <Slider
              value={[isMuted ? 0 : volume]}
              max={1}
              step={0.01}
              onValueChange={handleVolumeChange}
              className="flex-1"
              data-testid="slider-volume"
            />
          </div>

          {/* Mobile Controls Button */}
          <Sheet open={mobileControlsOpen} onOpenChange={setMobileControlsOpen}>
            <SheetTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                className="md:hidden h-8 w-8"
                data-testid="button-mobile-controls"
              >
                <Settings className="h-4 w-4" />
              </Button>
            </SheetTrigger>
            <SheetContent side="bottom" className="h-auto max-h-[70vh]">
              <SheetHeader>
                <SheetTitle>Opciones de Reproducción</SheetTitle>
              </SheetHeader>
              <div className="space-y-6 py-4">
                {/* Playback Speed - Mobile */}
                <div>
                  <Label className="text-sm font-medium mb-3 block">Velocidad de reproducción</Label>
                  <div className="flex flex-wrap gap-2">
                    {PLAYBACK_SPEEDS.map(speed => (
                      <Button
                        key={speed}
                        variant={playbackRate === speed ? "default" : "outline"}
                        size="sm"
                        onClick={() => changePlaybackRate(speed)}
                        data-testid={`mobile-speed-${speed}`}
                      >
                        {speed}x
                      </Button>
                    ))}
                  </div>
                </div>

                {/* Skip Amount - Mobile */}
                <div>
                  <Label className="text-sm font-medium mb-3 block">Salto de tiempo</Label>
                  <div className="flex gap-2">
                    {SKIP_AMOUNTS.map(amount => (
                      <Button
                        key={amount}
                        variant={skipAmount === amount ? "default" : "outline"}
                        size="sm"
                        onClick={() => setSkipAmount(amount)}
                        data-testid={`mobile-skip-${amount}`}
                      >
                        {amount}s
                      </Button>
                    ))}
                  </div>
                </div>

                {/* Sleep Timer - Mobile */}
                <div>
                  <Label className="text-sm font-medium mb-3 block">Temporizador de sueño</Label>
                  {sleepTimer !== null && (
                    <Button
                      variant="destructive"
                      size="sm"
                      onClick={cancelSleepTimer}
                      className="mb-2 w-full"
                      data-testid="mobile-cancel-sleep"
                    >
                      <X className="h-4 w-4 mr-2" />
                      Cancelar ({sleepTimer === -1 ? "Final del capítulo" : formatTime(sleepTimerRemaining || 0)})
                    </Button>
                  )}
                  <div className="grid grid-cols-2 gap-2">
                    {SLEEP_TIMER_OPTIONS.map(option => (
                      <Button
                        key={option.value}
                        variant="outline"
                        size="sm"
                        onClick={() => {
                          startSleepTimer(option.value);
                          setMobileControlsOpen(false);
                        }}
                        data-testid={`mobile-sleep-${option.value}`}
                      >
                        {option.label}
                      </Button>
                    ))}
                  </div>
                </div>

                {/* Volume - Mobile */}
                <div>
                  <Label className="text-sm font-medium mb-3 block">Volumen</Label>
                  <div className="flex items-center gap-3">
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={toggleMute}
                      data-testid="mobile-mute"
                    >
                      {isMuted || volume === 0 ? (
                        <VolumeX className="h-5 w-5" />
                      ) : (
                        <Volume2 className="h-5 w-5" />
                      )}
                    </Button>
                    <Slider
                      value={[isMuted ? 0 : volume]}
                      max={1}
                      step={0.01}
                      onValueChange={handleVolumeChange}
                      className="flex-1"
                      data-testid="mobile-slider-volume"
                    />
                    <span className="text-sm w-12 text-right">{Math.round(volume * 100)}%</span>
                  </div>
                </div>

                {/* Jump to Time - Mobile */}
                <div>
                  <Label className="text-sm font-medium mb-3 block">Ir a tiempo específico</Label>
                  <div className="flex gap-2 items-end">
                    <div className="flex-1">
                      <Label htmlFor="mobile-jump-minutes" className="text-xs mb-1 block text-muted-foreground">
                        Minutos
                      </Label>
                      <Input
                        id="mobile-jump-minutes"
                        type="number"
                        min="0"
                        value={jumpMinutes}
                        onChange={(e) => setJumpMinutes(e.target.value)}
                        placeholder="0"
                        data-testid="mobile-input-jump-minutes"
                      />
                    </div>
                    <div className="flex-1">
                      <Label htmlFor="mobile-jump-seconds" className="text-xs mb-1 block text-muted-foreground">
                        Segundos
                      </Label>
                      <Input
                        id="mobile-jump-seconds"
                        type="number"
                        min="0"
                        max="59"
                        value={jumpSeconds}
                        onChange={(e) => setJumpSeconds(e.target.value)}
                        placeholder="0"
                        data-testid="mobile-input-jump-seconds"
                      />
                    </div>
                    <Button 
                      onClick={() => {
                        handleJumpToTime();
                        setMobileControlsOpen(false);
                      }}
                      data-testid="mobile-button-jump"
                    >
                      Ir
                    </Button>
                  </div>
                </div>
              </div>
            </SheetContent>
          </Sheet>
        </div>
      </div>
    </div>
  );
}
