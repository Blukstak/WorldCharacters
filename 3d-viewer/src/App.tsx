import { useState, useCallback, useRef, useEffect } from 'react';
import { BabylonViewer } from './components/BabylonViewer';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from './components/ui/card';
import { Button } from './components/ui/button';
import { Play, Pause, Upload, X, Users, Menu, Maximize, Video, Library } from 'lucide-react';
import { AnimationGroup, AbstractMesh } from '@babylonjs/core';
import { VideoStreamOverlay } from './components/VideoStreamOverlay';
import { useColyseus } from './hooks/useColyseus';
import type { ColyseusManager } from './multiplayer/ColyseusManager';
import './index.css';

interface AnimationInfo {
  name: string;
  isPlaying: boolean;
}

interface ModelInfo {
  name: string;
  path: string;
  description: string;
}

const AVAILABLE_MODELS: ModelInfo[] = [
  {
    name: 'Green Guy',
    path: '/models/GreenGuy_Animated.glb',
    description: 'Green animated character',
  },
  {
    name: 'Business Man',
    path: '/models/BusinessMan.glb',
    description: 'Professional businessman in suit',
  },
];

function App() {
  const [modelFile, setModelFile] = useState<File | string | null>('/models/GreenGuy_Animated.glb');
  const [showModelSelector, setShowModelSelector] = useState(false);
  const [animations, setAnimations] = useState<AnimationInfo[]>([]);
  const [isDragging, setIsDragging] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [demoMode, setDemoMode] = useState(false);
  const [videoStreamMode, setVideoStreamMode] = useState(false);
  const [multiplayerMode, setMultiplayerMode] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const animationGroupsRef = useRef<AnimationGroup[]>([]);
  const viewerContainerRef = useRef<HTMLDivElement>(null);
  const colyseusManagerRef = useRef<ColyseusManager | null>(null);

  // Generate stable player name once
  const playerNameRef = useRef(`Player-${Math.random().toString(36).substr(2, 9)}`);

  // Initialize Colyseus multiplayer hook
  const { manager: colyseusManager, playerCount } = useColyseus({
    enabled: multiplayerMode,
    serverUrl: 'ws://localhost:2567',
    roomName: 'game',
    playerName: playerNameRef.current,
    // Don't send modelPath - let server randomly assign models
  });

  // Update manager ref when it changes
  useEffect(() => {
    colyseusManagerRef.current = colyseusManager;
  }, [colyseusManager]);

  const handleModelLoaded = useCallback((animationGroups: AnimationGroup[], _meshes: AbstractMesh[]) => {
    animationGroupsRef.current = animationGroups;

    // Filter to show walk and wave animations (accept any walk variation)
    const filteredGroups = animationGroups.filter((group) => {
      const name = (group.name || '').toLowerCase();
      // Include wave animations
      if (name.includes('wave')) return true;
      // Include any walk animation
      if (name.includes('walk')) return true;
      return false;
    });

    // Find best walk animation and auto-play it
    // Prefer "standard_walk" if available, otherwise use first walk animation
    let walkIndex = animationGroups.findIndex((group) => {
      const name = (group.name || '').toLowerCase();
      return name === 'standard_walk' || name.includes('standard') && name.includes('walk');
    });

    // If no standard_walk found, use first walk animation
    if (walkIndex === -1) {
      walkIndex = animationGroups.findIndex((group) => {
        const name = (group.name || '').toLowerCase();
        return name.includes('walk');
      });
    }

    const animInfos: AnimationInfo[] = filteredGroups.map((group) => {
      const groupIndex = animationGroups.indexOf(group);
      const isWalk = groupIndex === walkIndex;
      if (isWalk && !demoMode) {
        group.start(true);
      }
      return {
        name: group.name || 'Unnamed Animation',
        isPlaying: isWalk && !demoMode,
      };
    });
    setAnimations(animInfos);
    setError(null);
  }, [demoMode]);

  const handleLoadError = useCallback((err: Error) => {
    setError(err.message);
    setAnimations([]);
  }, []);

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(true);
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
  }, []);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);

    const files = Array.from(e.dataTransfer.files);
    const glbFile = files.find((file) =>
      file.name.toLowerCase().endsWith('.glb') ||
      file.name.toLowerCase().endsWith('.gltf')
    );

    if (glbFile) {
      setModelFile(glbFile);
      setError(null);
    } else {
      setError('Please drop a GLB or GLTF file');
    }
  }, []);

  const handleFileSelect = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setModelFile(file);
      setError(null);
    }
  }, []);

  const handleBrowseClick = useCallback(() => {
    fileInputRef.current?.click();
  }, []);

  const handleClearModel = useCallback(() => {
    setModelFile(null);
    setAnimations([]);
    setError(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  }, []);

  const toggleAnimation = useCallback((index: number) => {
    // Find the actual animation group by name since we're filtering the display
    const animName = animations[index]?.name;
    const group = animationGroupsRef.current.find((g) => g.name === animName);
    if (!group) return;

    setAnimations((prev) => {
      const updated = [...prev];
      const anim = updated[index];

      if (anim.isPlaying) {
        group.stop();
        updated[index] = { ...anim, isPlaying: false };
      } else {
        group.start(true);
        updated[index] = { ...anim, isPlaying: true };
      }

      return updated;
    });
  }, [animations]);

  const stopAllAnimations = useCallback(() => {
    animationGroupsRef.current.forEach((group) => group.stop());
    setAnimations((prev) => prev.map((anim) => ({ ...anim, isPlaying: false })));
  }, []);

  const toggleDemoMode = useCallback(() => {
    setDemoMode((prev) => !prev);
    setVideoStreamMode(false);
  }, []);

  const toggleVideoStreamMode = useCallback(() => {
    setVideoStreamMode((prev) => {
      const next = !prev;
      if (next) {
        setDemoMode(true);
      } else {
        setDemoMode(false);
      }
      return next;
    });
  }, []);

  const toggleMultiplayerMode = useCallback(() => {
    setMultiplayerMode((prev) => {
      const next = !prev;
      if (next) {
        setVideoStreamMode(true);
        setDemoMode(false);
      } else {
        setVideoStreamMode(false);
      }
      return next;
    });
  }, []);

  const handleFullscreen = useCallback(() => {
    if (!viewerContainerRef.current) return;

    if (!document.fullscreenElement) {
      viewerContainerRef.current.requestFullscreen().catch((err) => {
        console.error('Error entering fullscreen:', err);
      });
    } else {
      document.exitFullscreen();
    }
  }, []);

  const handleModelSelect = useCallback((modelPath: string) => {
    setModelFile(modelPath);
    setShowModelSelector(false);
    setError(null);
    setDemoMode(false);
    setVideoStreamMode(false);
  }, []);

  // Find walk animation index
  const walkAnimationIndex = animations.findIndex((anim) =>
    anim.name.toLowerCase().includes('walk')
  );

  return (
    <div className="flex h-screen bg-background text-foreground">
      {/* Main 3D Viewer Area */}
      <div className="flex-1 flex flex-col">
        {/* Header */}
        <header className="border-b px-4 md:px-6 py-4 flex items-center justify-between">
          <div>
            <h1 className="text-xl md:text-2xl font-bold">3D Model Viewer</h1>
            <p className="text-xs md:text-sm text-muted-foreground hidden sm:block">Drag and drop GLB files to view</p>
          </div>
          <div className="flex gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setShowModelSelector(!showModelSelector)}
              className="hidden sm:flex"
            >
              <Library className="w-4 h-4 mr-2" />
              Models
            </Button>
            {modelFile && (
              <Button
                variant="outline"
                size="icon"
                className="md:hidden"
                onClick={() => setSidebarOpen(!sidebarOpen)}
              >
                <Menu className="w-5 h-5" />
              </Button>
            )}
          </div>
        </header>

        {/* Model Selector Modal */}
        {showModelSelector && (
          <>
            <div
              className="fixed inset-0 bg-black/50 z-40"
              onClick={() => setShowModelSelector(false)}
            />
            <div className="fixed top-20 left-1/2 -translate-x-1/2 w-full max-w-2xl z-50 p-4">
              <Card>
                <CardHeader>
                  <div className="flex items-center justify-between">
                    <CardTitle>Available Models</CardTitle>
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => setShowModelSelector(false)}
                    >
                      <X className="w-4 h-4" />
                    </Button>
                  </div>
                  <CardDescription>
                    Choose from our collection of 3D models
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {AVAILABLE_MODELS.map((model) => (
                      <Card
                        key={model.path}
                        className={`cursor-pointer transition-all hover:border-primary ${
                          modelFile === model.path ? 'border-primary bg-primary/5' : ''
                        }`}
                        onClick={() => handleModelSelect(model.path)}
                      >
                        <CardHeader>
                          <CardTitle className="text-base">{model.name}</CardTitle>
                          <CardDescription className="text-sm">
                            {model.description}
                          </CardDescription>
                        </CardHeader>
                        <CardContent>
                          <div className="flex items-center gap-2 text-sm text-muted-foreground">
                            <Library className="w-4 h-4" />
                            <span>{model.path.split('/').pop()}</span>
                          </div>
                          {modelFile === model.path && (
                            <div className="mt-2 text-sm font-medium text-primary">
                              Currently loaded
                            </div>
                          )}
                        </CardContent>
                      </Card>
                    ))}
                  </div>
                </CardContent>
              </Card>
            </div>
          </>
        )}

        {/* Viewer Container */}
        <div className="flex-1 p-2 md:p-4" ref={viewerContainerRef}>
          {!modelFile ? (
            <div
              onDragOver={handleDragOver}
              onDragLeave={handleDragLeave}
              onDrop={handleDrop}
              className={`
                h-full rounded-lg border-2 border-dashed transition-colors
                flex flex-col items-center justify-center gap-4
                ${isDragging ? 'border-primary bg-primary/10' : 'border-border bg-card/50'}
              `}
            >
              <Upload className="w-12 md:w-16 h-12 md:h-16 text-muted-foreground" />
              <div className="text-center px-4">
                <p className="text-base md:text-lg font-medium mb-2">Drop your GLB file here</p>
                <p className="text-xs md:text-sm text-muted-foreground mb-4">or</p>
                <Button onClick={handleBrowseClick}>
                  Browse Files
                </Button>
              </div>
              <input
                ref={fileInputRef}
                type="file"
                accept=".glb,.gltf"
                onChange={handleFileSelect}
                className="hidden"
              />
            </div>
          ) : (
            <div className="h-full rounded-lg overflow-hidden border bg-card relative">
              <BabylonViewer
                modelFile={modelFile}
                onModelLoaded={handleModelLoaded}
                onLoadError={handleLoadError}
                demoMode={demoMode}
                multiplayerMode={multiplayerMode}
                colyseusManager={colyseusManager}
              />

              {/* Fullscreen button */}
              <Button
                variant="secondary"
                size="icon"
                className="absolute top-3 right-3 z-10 shadow-lg"
                onClick={handleFullscreen}
                title="Toggle fullscreen"
              >
                <Maximize className="w-4 h-4" />
              </Button>

              {/* Video stream overlay */}
              {videoStreamMode && (
                <VideoStreamOverlay />
              )}
            </div>
          )}
        </div>

        {/* Error Display */}
        {error && (
          <div className="mx-4 mb-4 p-4 bg-destructive/10 border border-destructive rounded-lg">
            <p className="text-sm text-destructive">{error}</p>
          </div>
        )}
      </div>

      {/* Sidebar - Animations Panel */}
      {modelFile && (
        <>
          {/* Mobile overlay backdrop */}
          {sidebarOpen && (
            <div
              className="fixed inset-0 bg-black/50 z-40 md:hidden"
              onClick={() => setSidebarOpen(false)}
            />
          )}

          <aside className={`
            fixed md:relative top-0 right-0 h-full
            w-80 max-w-[90vw] border-l bg-card flex flex-col z-50
            transform transition-transform duration-200 ease-in-out
            ${sidebarOpen ? 'translate-x-0' : 'translate-x-full md:translate-x-0'}
          `}>
            <div className="p-4 border-b">
              <div className="flex items-center justify-between mb-2">
                <h2 className="text-lg font-semibold">Model Info</h2>
                <div className="flex gap-1">
                  <Button
                    variant="ghost"
                    size="icon"
                    className="md:hidden"
                    onClick={() => setSidebarOpen(false)}
                  >
                    <X className="w-4 h-4" />
                  </Button>
                  <Button variant="ghost" size="icon" onClick={handleClearModel}>
                    <X className="w-4 h-4" />
                  </Button>
                </div>
              </div>
            <p className="text-sm text-muted-foreground truncate" title={typeof modelFile === 'string' ? modelFile : modelFile.name}>
              {typeof modelFile === 'string' ? modelFile.split('/').pop() : modelFile.name}
            </p>
            {typeof modelFile !== 'string' && (
              <p className="text-xs text-muted-foreground mt-1">
                {(modelFile.size / 1024).toFixed(2)} KB
              </p>
            )}
          </div>

          <div className="m-4 border-0">
            <div className="pb-3">
              <h3 className="text-base font-semibold">Animations</h3>
              <p className="text-sm text-muted-foreground">
                {animations.length === 0
                  ? 'No animations found'
                  : `${animations.length} animation${animations.length === 1 ? '' : 's'} available`}
              </p>
            </div>
            {animations.length > 0 && (
              <div className="space-y-2">
                {walkAnimationIndex >= 0 && (
                  <>
                    <Button
                      variant={demoMode && !videoStreamMode ? "default" : "secondary"}
                      size="lg"
                      onClick={toggleDemoMode}
                      className="w-full"
                      disabled={videoStreamMode}
                    >
                      <Users className="w-5 h-5 mr-2" />
                      {demoMode && !videoStreamMode ? 'Exit Demo Mode' : '100 Characters Demo'}
                    </Button>
                    <Button
                      variant={videoStreamMode ? "default" : "secondary"}
                      size="lg"
                      onClick={toggleVideoStreamMode}
                      className="w-full"
                      disabled={multiplayerMode}
                    >
                      <Video className="w-5 h-5 mr-2" />
                      {videoStreamMode ? 'Exit Video Stream' : 'Video Stream Demo'}
                    </Button>
                    <Button
                      variant={multiplayerMode ? "default" : "secondary"}
                      size="lg"
                      onClick={toggleMultiplayerMode}
                      className="w-full"
                    >
                      <Users className="w-5 h-5 mr-2" />
                      {multiplayerMode ? `Multiplayer (${playerCount} players)` : 'Multiplayer Mode'}
                    </Button>
                  </>
                )}
                <Button
                  variant="outline"
                  size="sm"
                  onClick={stopAllAnimations}
                  className="w-full"
                  disabled={demoMode || multiplayerMode}
                >
                  Stop All
                </Button>
              </div>
            )}
          </div>

          {animations.length > 0 && !demoMode && (
            <div className="flex-1 overflow-y-auto px-4">
              <div className="space-y-2 pb-4">
                {animations.map((anim, index) => (
                  <Card key={index} className="overflow-hidden">
                    <CardContent className="p-3">
                      <div className="flex items-center justify-between gap-2">
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium truncate" title={anim.name}>
                            {anim.name}
                          </p>
                          <p className="text-xs text-muted-foreground">
                            {anim.isPlaying ? 'Playing' : 'Stopped'}
                          </p>
                        </div>
                        <Button
                          size="icon"
                          variant={anim.isPlaying ? 'default' : 'outline'}
                          onClick={() => toggleAnimation(index)}
                        >
                          {anim.isPlaying ? (
                            <Pause className="w-4 h-4" />
                          ) : (
                            <Play className="w-4 h-4" />
                          )}
                        </Button>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            </div>
          )}
          {demoMode && (
            <div className="flex-1 px-4 flex items-center justify-center">
              <div className="text-center">
                {videoStreamMode ? (
                  <>
                    <Video className="w-12 md:w-16 h-12 md:h-16 mx-auto mb-4 text-muted-foreground" />
                    <p className="text-sm text-muted-foreground">
                      Video Stream Active
                    </p>
                    <p className="text-xs text-muted-foreground mt-1">
                      Publishing camera &amp; mic
                    </p>
                  </>
                ) : (
                  <>
                    <Users className="w-12 md:w-16 h-12 md:h-16 mx-auto mb-4 text-muted-foreground" />
                    <p className="text-sm text-muted-foreground">
                      Demo Mode Active
                    </p>
                    <p className="text-xs text-muted-foreground mt-1">
                      100 characters walking
                    </p>
                  </>
                )}
              </div>
            </div>
          )}
        </aside>
        </>
      )}
    </div>
  );
}

export default App;
