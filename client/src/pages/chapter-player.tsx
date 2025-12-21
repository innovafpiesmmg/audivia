import { useState, useRef, useEffect, useCallback, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { useRoute, Link, useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { Slider } from "@/components/ui/slider";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
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
  SkipBack, 
  SkipForward, 
  Volume2, 
  VolumeX,
  ChevronLeft,
  BookOpen,
  RotateCcw,
  RotateCw,
  List,
  Gauge,
  Moon,
  Clock,
  Settings,
  X
} from "lucide-react";
import type { ChapterWithAudiobook, Chapter } from "@shared/schema";

function formatTime(seconds: number): string {
  if (!seconds || isNaN(seconds)) return "0:00";
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = Math.floor(seconds % 60);
  if (h > 0) {
    return `${h}:${m.toString().padStart(2, "0")}:${s.toString().padStart(2, "0")}`;
  }
  return `${m}:${s.toString().padStart(2, "0")}`;
}

function formatTimeRemaining(seconds: number): string {
  if (!seconds || isNaN(seconds)) return "-0:00";
  return `-${formatTime(seconds)}`;
}

const PLAYBACK_SPEEDS = [0.5, 0.75, 0.8, 1, 1.1, 1.25, 1.5, 1.75, 2, 2.5, 3];
const SKIP_AMOUNTS = [10, 15, 30];
const SLEEP_TIMER_OPTIONS = [
  { label: "5 min", value: 5 * 60 },
  { label: "10 min", value: 10 * 60 },
  { label: "15 min", value: 15 * 60 },
  { label: "30 min", value: 30 * 60 },
  { label: "45 min", value: 45 * 60 },
  { label: "1 hora", value: 60 * 60 },
  { label: "Final del capítulo", value: -1 },
];

export default function ChapterPlayer() {
  const [, params] = useRoute("/chapter/:id");
  const chapterId = params?.id;
  const [, setLocation] = useLocation();

  const audioRef = useRef<HTMLAudioElement>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [volume, setVolume] = useState(1);
  const [isMuted, setIsMuted] = useState(false);
  const [playbackRate, setPlaybackRate] = useState(1);
  const [skipAmount, setSkipAmount] = useState(15);
  const [showTimeRemaining, setShowTimeRemaining] = useState(false);
  const [sleepTimer, setSleepTimer] = useState<number | null>(null);
  const [sleepTimerRemaining, setSleepTimerRemaining] = useState<number | null>(null);
  const [jumpDialogOpen, setJumpDialogOpen] = useState(false);
  const [jumpMinutes, setJumpMinutes] = useState("");
  const [jumpSeconds, setJumpSeconds] = useState("");
  const [mobileSettingsOpen, setMobileSettingsOpen] = useState(false);
  const sleepTimerInterval = useRef<NodeJS.Timeout | null>(null);

  const { data: chapter, isLoading, error } = useQuery<ChapterWithAudiobook>({
    queryKey: [`/api/chapters/${chapterId}`],
    enabled: !!chapterId,
  });

  const { data: audiobookData } = useQuery<{ chapters: Chapter[] }>({
    queryKey: [`/api/audiobooks/${chapter?.audiobook.id}`],
    enabled: !!chapter?.audiobook.id,
  });
  
  const allChapters = audiobookData?.chapters || [];

  const { previousChapter, nextChapter } = useMemo(() => {
    if (!chapter || allChapters.length === 0) {
      return { previousChapter: null, nextChapter: null };
    }
    const sortedChapters = [...allChapters].sort((a, b) => a.chapterNumber - b.chapterNumber);
    const currentIndex = sortedChapters.findIndex(c => c.id === chapter.id);
    
    return {
      previousChapter: currentIndex > 0 ? sortedChapters[currentIndex - 1] : null,
      nextChapter: currentIndex < sortedChapters.length - 1 ? sortedChapters[currentIndex + 1] : null,
    };
  }, [chapter, allChapters]);

  const goToPreviousChapter = () => {
    if (previousChapter) {
      setLocation(`/chapter/${previousChapter.id}`);
    }
  };

  const goToNextChapter = () => {
    if (nextChapter) {
      setLocation(`/chapter/${nextChapter.id}`);
    }
  };

  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;

    const updateTime = () => setCurrentTime(audio.currentTime);
    const updateDuration = () => setDuration(audio.duration || 0);
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
  }, [chapter, sleepTimer]);

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
    const audio = audioRef.current;
    if (!audio) return;

    if (isPlaying) {
      audio.pause();
    } else {
      audio.play();
    }
    setIsPlaying(!isPlaying);
  };

  const seek = (value: number[]) => {
    const audio = audioRef.current;
    if (!audio) return;
    audio.currentTime = value[0];
    setCurrentTime(value[0]);
  };

  const skipForward = () => {
    const audio = audioRef.current;
    if (!audio) return;
    audio.currentTime = Math.min(duration, audio.currentTime + skipAmount);
  };

  const skipBackward = () => {
    const audio = audioRef.current;
    if (!audio) return;
    audio.currentTime = Math.max(0, audio.currentTime - skipAmount);
  };

  const toggleMute = () => {
    const audio = audioRef.current;
    if (!audio) return;
    audio.muted = !isMuted;
    setIsMuted(!isMuted);
  };

  const changeVolume = (value: number[]) => {
    const audio = audioRef.current;
    if (!audio) return;
    audio.volume = value[0];
    setVolume(value[0]);
    if (value[0] > 0 && isMuted) {
      setIsMuted(false);
      audio.muted = false;
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

  const timeRemaining = duration - currentTime;

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center p-4">
        <Card className="w-full max-w-2xl">
          <CardContent className="p-8 space-y-6">
            <Skeleton className="h-64 w-64 mx-auto rounded-xl" />
            <div className="space-y-2 text-center">
              <Skeleton className="h-8 w-3/4 mx-auto" />
              <Skeleton className="h-6 w-1/2 mx-auto" />
            </div>
            <Skeleton className="h-2 w-full" />
            <div className="flex justify-center gap-4">
              <Skeleton className="h-12 w-12 rounded-full" />
              <Skeleton className="h-16 w-16 rounded-full" />
              <Skeleton className="h-12 w-12 rounded-full" />
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (error || !chapter) {
    return (
      <div className="container mx-auto px-4 py-16 text-center">
        <BookOpen className="w-16 h-16 mx-auto text-muted-foreground/50 mb-4" />
        <h2 className="text-2xl font-bold mb-2">Capitulo no encontrado</h2>
        <p className="text-muted-foreground mb-6">El capitulo que buscas no existe.</p>
        <Link href="/">
          <Button>
            <ChevronLeft className="w-4 h-4 mr-2" />
            Volver al inicio
          </Button>
        </Link>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-primary/5 to-background flex flex-col">
      <div className="container mx-auto px-4 py-4">
        <Link href={`/audiobook/${chapter.audiobook.id}`}>
          <Button variant="ghost" size="sm">
            <ChevronLeft className="w-4 h-4 mr-1" />
            Volver al audiolibro
          </Button>
        </Link>
      </div>

      <div className="flex-1 flex items-center justify-center p-4">
        <Card className="w-full max-w-2xl shadow-xl">
          <CardContent className="p-8">
            <div className="aspect-square max-w-xs mx-auto mb-8 rounded-xl overflow-hidden shadow-lg">
              {chapter.audiobook.coverArtUrl ? (
                <img
                  src={chapter.audiobook.coverArtUrl}
                  alt={chapter.audiobook.title}
                  className="w-full h-full object-cover"
                />
              ) : (
                <div className="w-full h-full bg-gradient-to-br from-primary/30 to-primary/60 flex items-center justify-center">
                  <BookOpen className="w-24 h-24 text-primary-foreground/60" />
                </div>
              )}
            </div>

            <div className="text-center mb-6">
              <h1 className="font-serif text-2xl font-bold mb-2" data-testid="text-chapter-title">
                {chapter.title}
              </h1>
              <Link href={`/audiobook/${chapter.audiobook.id}`}>
                <p className="text-muted-foreground hover:text-primary transition-colors">
                  {chapter.audiobook.title} - {chapter.audiobook.author}
                </p>
              </Link>
              {sleepTimer !== null && (
                <p className="text-xs text-primary flex items-center justify-center gap-1 mt-2">
                  <Moon className="h-3 w-3" />
                  {sleepTimer === -1 
                    ? "Apagar al final del capítulo" 
                    : sleepTimerRemaining 
                      ? `Apagar en ${formatTime(sleepTimerRemaining)}`
                      : null
                  }
                </p>
              )}
            </div>

            {chapter.audioUrl && (
              <audio ref={audioRef} src={chapter.audioUrl} preload="metadata" />
            )}

            {/* Progress Bar */}
            <div className="space-y-2 mb-6">
              <Slider
                value={[currentTime]}
                max={duration || 100}
                step={1}
                onValueChange={seek}
                className="w-full"
                data-testid="slider-progress"
              />
              <div className="flex justify-between text-sm text-muted-foreground">
                <span data-testid="text-current-time">{formatTime(currentTime)}</span>
                <button 
                  onClick={() => setShowTimeRemaining(!showTimeRemaining)}
                  className="hover:text-foreground transition-colors"
                  data-testid="button-toggle-time"
                >
                  {showTimeRemaining 
                    ? formatTimeRemaining(timeRemaining)
                    : formatTime(duration)
                  }
                </button>
              </div>
            </div>

            {/* Main Playback Controls */}
            <div className="flex items-center justify-center gap-4 mb-6">
              <Button
                variant="ghost"
                size="icon"
                onClick={skipBackward}
                className="relative"
                data-testid="button-skip-back"
                title={`Retroceder ${skipAmount}s`}
              >
                <RotateCcw className="w-6 h-6" />
                <span className="absolute text-[10px] font-bold">{skipAmount}</span>
              </Button>
              <Button
                variant="ghost"
                size="icon"
                onClick={goToPreviousChapter}
                disabled={!previousChapter}
                data-testid="button-previous"
                title={previousChapter ? `Ir a: ${previousChapter.title}` : "No hay capitulo anterior"}
              >
                <SkipBack className="w-6 h-6" />
              </Button>
              <Button
                size="lg"
                className="w-16 h-16 rounded-full"
                onClick={togglePlay}
                data-testid="button-play-pause"
              >
                {isPlaying ? (
                  <Pause className="w-8 h-8" />
                ) : (
                  <Play className="w-8 h-8 ml-1" />
                )}
              </Button>
              <Button
                variant="ghost"
                size="icon"
                onClick={goToNextChapter}
                disabled={!nextChapter}
                data-testid="button-next"
                title={nextChapter ? `Ir a: ${nextChapter.title}` : "No hay capitulo siguiente"}
              >
                <SkipForward className="w-6 h-6" />
              </Button>
              <Button
                variant="ghost"
                size="icon"
                onClick={skipForward}
                className="relative"
                data-testid="button-skip-forward"
                title={`Avanzar ${skipAmount}s`}
              >
                <RotateCw className="w-6 h-6" />
                <span className="absolute text-[10px] font-bold">{skipAmount}</span>
              </Button>
            </div>

            {/* Advanced Controls Row */}
            <div className="flex items-center justify-between flex-wrap gap-4">
              {/* Volume */}
              <div className="flex items-center gap-2">
                <Button variant="ghost" size="icon" onClick={toggleMute} data-testid="button-mute">
                  {isMuted || volume === 0 ? (
                    <VolumeX className="w-5 h-5" />
                  ) : (
                    <Volume2 className="w-5 h-5" />
                  )}
                </Button>
                <Slider
                  value={[isMuted ? 0 : volume]}
                  max={1}
                  step={0.01}
                  onValueChange={changeVolume}
                  className="w-20"
                  data-testid="slider-volume"
                />
              </div>

              {/* Desktop Advanced Controls */}
              <div className="hidden md:flex items-center gap-2">
                {/* Playback Speed */}
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button variant="outline" size="sm" className="gap-1" data-testid="button-speed">
                      <Gauge className="h-4 w-4" />
                      {playbackRate}x
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent className="max-h-64 overflow-y-auto">
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

                {/* Skip Amount */}
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button variant="outline" size="sm" className="gap-1" data-testid="button-skip-amount">
                      <SkipForward className="h-4 w-4" />
                      {skipAmount}s
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent>
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
                      variant="outline" 
                      size="icon"
                      className={sleepTimer !== null ? "text-primary border-primary" : ""}
                      data-testid="button-sleep-timer"
                      title="Temporizador de sueño"
                    >
                      <Moon className="h-4 w-4" />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent>
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
                    <Button variant="outline" size="icon" data-testid="button-jump" title="Ir a tiempo">
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
                        <Label htmlFor="jump-minutes" className="text-sm mb-2 block">Minutos</Label>
                        <Input
                          id="jump-minutes"
                          type="number"
                          min="0"
                          value={jumpMinutes}
                          onChange={(e) => setJumpMinutes(e.target.value)}
                          placeholder="0"
                          data-testid="input-jump-minutes"
                        />
                      </div>
                      <div className="flex-1">
                        <Label htmlFor="jump-seconds" className="text-sm mb-2 block">Segundos</Label>
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
                      <Button variant="outline" onClick={() => setJumpDialogOpen(false)}>Cancelar</Button>
                      <Button onClick={handleJumpToTime}>Ir</Button>
                    </div>
                  </DialogContent>
                </Dialog>
              </div>

              {/* Mobile Settings Button */}
              <Sheet open={mobileSettingsOpen} onOpenChange={setMobileSettingsOpen}>
                <SheetTrigger asChild>
                  <Button variant="outline" size="icon" className="md:hidden" data-testid="button-mobile-settings">
                    <Settings className="h-4 w-4" />
                  </Button>
                </SheetTrigger>
                <SheetContent side="bottom" className="h-auto max-h-[80vh] overflow-y-auto">
                  <SheetHeader>
                    <SheetTitle>Opciones de Reproducción</SheetTitle>
                  </SheetHeader>
                  <div className="space-y-6 py-4">
                    {/* Playback Speed - Mobile */}
                    <div>
                      <Label className="text-sm font-medium mb-3 block">Velocidad</Label>
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
                          Cancelar ({sleepTimer === -1 ? "Final" : formatTime(sleepTimerRemaining || 0)})
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
                              setMobileSettingsOpen(false);
                            }}
                            data-testid={`mobile-sleep-${option.value}`}
                          >
                            {option.label}
                          </Button>
                        ))}
                      </div>
                    </div>

                    {/* Jump to Time - Mobile */}
                    <div>
                      <Label className="text-sm font-medium mb-3 block">Ir a tiempo específico</Label>
                      <div className="flex gap-2 items-end">
                        <div className="flex-1">
                          <Label htmlFor="mobile-jump-minutes" className="text-xs mb-1 block text-muted-foreground">Min</Label>
                          <Input
                            id="mobile-jump-minutes"
                            type="number"
                            min="0"
                            value={jumpMinutes}
                            onChange={(e) => setJumpMinutes(e.target.value)}
                            placeholder="0"
                            data-testid="mobile-input-minutes"
                          />
                        </div>
                        <div className="flex-1">
                          <Label htmlFor="mobile-jump-seconds" className="text-xs mb-1 block text-muted-foreground">Seg</Label>
                          <Input
                            id="mobile-jump-seconds"
                            type="number"
                            min="0"
                            max="59"
                            value={jumpSeconds}
                            onChange={(e) => setJumpSeconds(e.target.value)}
                            placeholder="0"
                            data-testid="mobile-input-seconds"
                          />
                        </div>
                        <Button 
                          onClick={() => {
                            handleJumpToTime();
                            setMobileSettingsOpen(false);
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

              {/* Chapter List Link */}
              <Link href={`/audiobook/${chapter.audiobook.id}`}>
                <Button variant="ghost" size="icon" data-testid="button-chapter-list">
                  <List className="w-5 h-5" />
                </Button>
              </Link>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
