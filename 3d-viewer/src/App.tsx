import { useState, useCallback, useRef } from 'react';
import { BabylonViewer } from './components/BabylonViewer';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from './components/ui/card';
import { Button } from './components/ui/button';
import { ScrollArea } from './components/ui/scroll-area';
import { Play, Pause, Upload, X, Users, Menu, Maximize } from 'lucide-react';
import { AnimationGroup, AbstractMesh } from '@babylonjs/core';
import './index.css';

interface AnimationInfo {
  name: string;
  isPlaying: boolean;
}

function App() {
  const [modelFile, setModelFile] = useState<File | string | null>('/models/GreenGuy_Animated.glb');
  const [animations, setAnimations] = useState<AnimationInfo[]>([]);
  const [isDragging, setIsDragging] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [demoMode, setDemoMode] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const animationGroupsRef = useRef<AnimationGroup[]>([]);
  const viewerContainerRef = useRef<HTMLDivElement>(null);

  const handleModelLoaded = useCallback((animationGroups: AnimationGroup[], _meshes: AbstractMesh[]) => {
    animationGroupsRef.current = animationGroups;

    // Filter to only show standard walk and wave animations (exclude move_walk and man_walk)
    const filteredGroups = animationGroups.filter((group) => {
      const name = (group.name || '').toLowerCase();
      // Include wave
      if (name.includes('wave')) return true;
      // Include only standard_walk, exclude man_walk and move_walk
      if (name.includes('standard') && name.includes('walk')) return true;
      return false;
    });

    // Find standard walk animation and auto-play it
    const walkIndex = animationGroups.findIndex((group) => {
      const name = (group.name || '').toLowerCase();
      return name.includes('standard') && name.includes('walk');
    });

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
        </header>

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
                  <Button
                    variant={demoMode ? "default" : "secondary"}
                    size="lg"
                    onClick={toggleDemoMode}
                    className="w-full"
                  >
                    <Users className="w-5 h-5 mr-2" />
                    {demoMode ? 'Exit Demo Mode' : '100 Characters Demo'}
                  </Button>
                )}
                <Button
                  variant="outline"
                  size="sm"
                  onClick={stopAllAnimations}
                  className="w-full"
                  disabled={demoMode}
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
                <Users className="w-12 md:w-16 h-12 md:h-16 mx-auto mb-4 text-muted-foreground" />
                <p className="text-sm text-muted-foreground">
                  Demo Mode Active
                </p>
                <p className="text-xs text-muted-foreground mt-1">
                  100 characters walking
                </p>
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
