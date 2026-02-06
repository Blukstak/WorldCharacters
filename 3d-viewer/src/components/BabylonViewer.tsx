import { useEffect, useRef, useState } from 'react';
import {
  Engine,
  Scene,
  ArcRotateCamera,
  HemisphericLight,
  Vector3,
  SceneLoader,
  AbstractMesh,
  AnimationGroup,
  Color4,
  TransformNode,
  MeshBuilder,
  StandardMaterial,
  Color3,
} from '@babylonjs/core';
import '@babylonjs/loaders/glTF';

interface BabylonViewerProps {
  onModelLoaded?: (animations: AnimationGroup[], meshes: AbstractMesh[]) => void;
  onLoadError?: (error: Error) => void;
  modelFile?: File | string | null;
  demoMode?: boolean;
}

export function BabylonViewer({ onModelLoaded, onLoadError, modelFile, demoMode = false }: BabylonViewerProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const engineRef = useRef<Engine | null>(null);
  const sceneRef = useRef<Scene | null>(null);
  const [diagnostics, setDiagnostics] = useState<string[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const originalMeshesRef = useRef<AbstractMesh[]>([]);
  const demoInstancesRef = useRef<TransformNode[]>([]);
  const animationGroupsRef = useRef<AnimationGroup[]>([]);
  const demoObjectsRef = useRef<{
    floor?: AbstractMesh;
    walls: AbstractMesh[];
    obstacles: AbstractMesh[];
    moveObserver?: any;
  }>({ walls: [], obstacles: [] });

  const addDiagnostic = (message: string) => {
    console.log(message);
    setDiagnostics(prev => [...prev, message].slice(-20)); // Keep last 20 messages
  };

  // Initialize Babylon.js scene
  useEffect(() => {
    if (!canvasRef.current) return;

    const canvas = canvasRef.current;
    const engine = new Engine(canvas, true, {
      preserveDrawingBuffer: true,
      stencil: true,
    });
    engineRef.current = engine;

    const scene = new Scene(engine);
    scene.clearColor = new Color4(0.1, 0.1, 0.15, 1);
    sceneRef.current = scene;

    // Camera
    const camera = new ArcRotateCamera(
      'camera',
      Math.PI / 2,
      Math.PI / 2,
      5,
      Vector3.Zero(),
      scene
    );
    camera.attachControl(canvas, true);
    camera.wheelPrecision = 50;
    camera.minZ = 0.1;

    // Light
    const light = new HemisphericLight('light', new Vector3(0, 1, 0), scene);
    light.intensity = 0.7;

    // Render loop
    engine.runRenderLoop(() => {
      scene.render();
    });

    // Resize handler
    const handleResize = () => {
      engine.resize();
    };
    window.addEventListener('resize', handleResize);

    return () => {
      window.removeEventListener('resize', handleResize);
      scene.dispose();
      engine.dispose();
    };
  }, []);

  // Load model when file changes (but not during demo mode)
  useEffect(() => {
    if (!modelFile || !sceneRef.current || demoMode) return;

    const scene = sceneRef.current;
    const camera = scene.activeCamera as ArcRotateCamera;

    // Clear previous meshes and animations
    scene.meshes.forEach((mesh) => {
      if (mesh.name !== '__root__') {
        mesh.dispose();
      }
    });
    scene.animationGroups.forEach((group) => group.dispose());

    setIsLoading(true);

    // Create object URL for the file, or use the URL directly
    const url = typeof modelFile === 'string' ? modelFile : URL.createObjectURL(modelFile);
    const shouldRevokeUrl = typeof modelFile !== 'string';

    SceneLoader.ImportMeshAsync('', '', url, scene, undefined, '.glb')
      .then((result) => {
        const meshes = result.meshes;
        const animations = result.animationGroups;

        // Store references
        originalMeshesRef.current = meshes;

        // Stop all animations initially
        animations.forEach((anim) => anim.stop());

        // Log all available animations for debugging
        console.log('Available animations:', animations.map(a => a.name).join(', '));

        // Filter to show walk and wave animations
        // Accept any variation of walk animations (Walk, Standard_Walk, etc.)
        const safeAnimations: AnimationGroup[] = [];
        animations.forEach((anim) => {
          const name = (anim.name || '').toLowerCase();
          const isSafe = name.includes('wave') || name.includes('walk');

          if (isSafe) {
            safeAnimations.push(anim);
          }
        });

        animationGroupsRef.current = safeAnimations;

        // Center and scale model
        if (meshes.length > 0) {
          const bounds = meshes[0].getHierarchyBoundingVectors();
          const center = bounds.max.add(bounds.min).scale(0.5);
          const size = bounds.max.subtract(bounds.min);
          const maxDim = Math.max(size.x, size.y, size.z);

          // Position camera to view the model
          const distance = maxDim * 2;
          camera.target = center;
          camera.radius = distance;
          camera.alpha = Math.PI / 2;
          camera.beta = Math.PI / 3;
        }

        setIsLoading(false);
        onModelLoaded?.(safeAnimations, meshes);

        // Clean up object URL only if we created one
        if (shouldRevokeUrl) {
          URL.revokeObjectURL(url);
        }
      })
      .catch((error) => {
        console.error('Error loading model:', error);
        setIsLoading(false);
        onLoadError?.(error);
        if (shouldRevokeUrl) {
          URL.revokeObjectURL(url);
        }
      });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [modelFile, demoMode]);

  // Handle demo mode with 100 walking characters
  useEffect(() => {
    if (!sceneRef.current || !modelFile) return;

    const scene = sceneRef.current;
    const camera = scene.activeCamera as ArcRotateCamera;

    if (demoMode) {
      // Clear previous diagnostics
      setDiagnostics([]);
      addDiagnostic(`✓ Starting demo mode - disposing original character`);

      // DESTROY original character completely
      originalMeshesRef.current.forEach(mesh => mesh.dispose());
      originalMeshesRef.current = [];
      animationGroupsRef.current.forEach(anim => anim.dispose());
      animationGroupsRef.current = [];

      // Also dispose ALL meshes in the scene (except __root__) to be absolutely sure
      const meshesToDispose = scene.meshes.filter(m => m.name !== '__root__');
      meshesToDispose.forEach(mesh => mesh.dispose());
      addDiagnostic(`✓ Disposed ${meshesToDispose.length} meshes from scene`);

      addDiagnostic(`✓ Original character destroyed`);
      addDiagnostic(`✓ Loading fresh character from GLB file...`);

      // Room setup constants
      const areaSize = 50;
      const wallHeight = 5;
      const wallThickness = 0.5;

      // Load the model fresh from file
      const url = typeof modelFile === 'string' ? modelFile : URL.createObjectURL(modelFile);
      const shouldRevokeUrl = typeof modelFile !== 'string';

      SceneLoader.ImportMeshAsync('', '', url, scene, undefined, '.glb').then((result) => {
        const meshes = result.meshes;
        const animations = result.animationGroups;

        addDiagnostic(`✓ Loaded fresh character: ${meshes.length} meshes, ${animations.length} animations`);

        // Debug: Log mesh hierarchy
        meshes.forEach((mesh, idx) => {
          addDiagnostic(`  Mesh ${idx}: "${mesh.name}", parent: ${mesh.parent?.name || 'null'}, enabled: ${mesh.isEnabled()}`);
        });

        // Find any walk animation
        const walkAnimation = animations.find(anim => {
          const name = (anim.name || '').toLowerCase();
          return name.includes('walk');
        });

        if (!walkAnimation) {
          addDiagnostic(`ERROR: No walk animation found. Available: ${animations.map(a => a.name).join(', ')}`);
          return;
        }

        addDiagnostic(`✓ Found walk animation: ${walkAnimation.name}`);

        // Stop all animations initially
        animations.forEach(anim => anim.stop());

        // Store references
        originalMeshesRef.current = meshes;
        animationGroupsRef.current = animations;

        // Add extra lighting for the demo
        const hemiLight = scene.lights[0] as HemisphericLight;
        if (hemiLight) {
          hemiLight.intensity = 1.5;
        }

        // Create floor
        const floor = MeshBuilder.CreateGround('floor', { width: areaSize, height: areaSize }, scene);
        const floorMat = new StandardMaterial('floorMat', scene);
        floorMat.diffuseColor = new Color3(0.3, 0.3, 0.35);
        floorMat.specularColor = new Color3(0.1, 0.1, 0.1);
        floor.material = floorMat;
        floor.position.y = 0;

        // Create walls
        const wallMat = new StandardMaterial('wallMat', scene);
        wallMat.diffuseColor = new Color3(0.4, 0.4, 0.45);
        wallMat.alpha = 0.3;

        const walls: AbstractMesh[] = [];
        const northWall = MeshBuilder.CreateBox('northWall', { width: areaSize, height: wallHeight, depth: wallThickness }, scene);
        northWall.position = new Vector3(0, wallHeight / 2, areaSize / 2);
        northWall.material = wallMat;
        walls.push(northWall);

        const southWall = MeshBuilder.CreateBox('southWall', { width: areaSize, height: wallHeight, depth: wallThickness }, scene);
        southWall.position = new Vector3(0, wallHeight / 2, -areaSize / 2);
        southWall.material = wallMat;
        walls.push(southWall);

        const eastWall = MeshBuilder.CreateBox('eastWall', { width: wallThickness, height: wallHeight, depth: areaSize }, scene);
        eastWall.position = new Vector3(areaSize / 2, wallHeight / 2, 0);
        eastWall.material = wallMat;
        walls.push(eastWall);

        const westWall = MeshBuilder.CreateBox('westWall', { width: wallThickness, height: wallHeight, depth: areaSize }, scene);
        westWall.position = new Vector3(-areaSize / 2, wallHeight / 2, 0);
        westWall.material = wallMat;
        walls.push(westWall);

        // Create obstacles
        const obstacleMat = new StandardMaterial('obstacleMat', scene);
        obstacleMat.diffuseColor = new Color3(0.6, 0.3, 0.2);

        const obstacles: AbstractMesh[] = [];
        const obstacleData: Array<{ position: Vector3, radius: number }> = [];

        for (let i = 0; i < 8; i++) {
          const size = 2 + Math.random() * 3;
          const x = (Math.random() - 0.5) * (areaSize - 10);
          const z = (Math.random() - 0.5) * (areaSize - 10);

          const obstacle = MeshBuilder.CreateBox(`obstacle_${i}`, { width: size, height: 3, depth: size }, scene);
          obstacle.position = new Vector3(x, 1.5, z);
          obstacle.material = obstacleMat;
          obstacles.push(obstacle);

          obstacleData.push({
            position: new Vector3(x, 0, z),
            radius: size * 0.7
          });
        }

        for (let i = 0; i < 5; i++) {
          const radius = 1 + Math.random() * 1.5;
          const x = (Math.random() - 0.5) * (areaSize - 10);
          const z = (Math.random() - 0.5) * (areaSize - 10);

          const obstacle = MeshBuilder.CreateCylinder(`cylinder_${i}`, { diameter: radius * 2, height: 4 }, scene);
          obstacle.position = new Vector3(x, 2, z);
          obstacle.material = obstacleMat;
          obstacles.push(obstacle);

          obstacleData.push({
            position: new Vector3(x, 0, z),
            radius: radius * 1.2
          });
        }

        // Helper function to generate waypoints
        const generateWaypoint = (): Vector3 => {
          const maxAttempts = 50;
          for (let attempt = 0; attempt < maxAttempts; attempt++) {
            const x = (Math.random() - 0.5) * (areaSize - 4);
            const z = (Math.random() - 0.5) * (areaSize - 4);
            const pos = new Vector3(x, 0, z);

            let valid = true;
            for (const obs of obstacleData) {
              const dist = Vector3.Distance(new Vector3(pos.x, 0, pos.z), obs.position);
              if (dist < obs.radius + 2) {
                valid = false;
                break;
              }
            }

            if (valid) return pos;
          }
          return Vector3.Zero();
        };

        // Create 1 character using the freshly loaded mesh
        const instances: TransformNode[] = [];

        interface CharacterData {
          mesh: TransformNode;
          currentWaypoint: Vector3;
          nextWaypoint: Vector3;
          velocity: Vector3;
          animation: AnimationGroup;
          speed: number;
        }

        const instanceData: CharacterData[] = [];

        const startPos = generateWaypoint();

        // Create a parent transform node
        const characterParent = new TransformNode(`character_parent_0`, scene);
        characterParent.position = startPos.clone();

        // Parent ALL root-level meshes (meshes with no parent) to the character transform
        const rootMeshes = meshes.filter(mesh => mesh.parent === null);
        addDiagnostic(`✓ Found ${rootMeshes.length} root meshes to parent`);

        rootMeshes.forEach((mesh) => {
          mesh.parent = characterParent;
          mesh.position = Vector3.Zero();
          mesh.rotation = Vector3.Zero();
        });

        addDiagnostic(`✓ Character positioned at ${startPos.toString()}`);

        instances.push(characterParent);
        demoInstancesRef.current = instances;

        // Start the walk animation
        walkAnimation.start(true, 1.0, walkAnimation.from, walkAnimation.to, false);
        addDiagnostic(`✓ Animation started: ${walkAnimation.name}`);

        // Initialize waypoint movement
        const waypoint = generateWaypoint();
        const direction = waypoint.subtract(startPos).normalize();
        const speed = 0.01;

        characterParent.rotation.y = Math.atan2(direction.x, direction.z) + Math.PI;

        instanceData.push({
          mesh: characterParent,
          currentWaypoint: startPos.clone(),
          nextWaypoint: waypoint,
          velocity: direction.scale(speed),
          animation: walkAnimation,
          speed: speed
        });

        addDiagnostic(`✓ Demo ready with 1 character`);

        // Adjust camera to view the entire area
        camera.target = Vector3.Zero();
        camera.radius = areaSize * 1.5;
        camera.alpha = Math.PI / 2;
        camera.beta = Math.PI / 4;

        // Improve zoom responsiveness for the larger scene
        camera.wheelPrecision = 1; // Lower = more sensitive (default is 3)
        camera.lowerRadiusLimit = 10;
        camera.upperRadiusLimit = 150;

        // Movement logic - update positions every frame
        const moveObserver = scene.onBeforeRenderObservable.add(() => {
        const halfArea = areaSize / 2;
        const avoidanceRadius = 3;
        const waypointReachThreshold = 1.5;

        instanceData.forEach((data) => {
          const pos = data.mesh.position;

          // Check if reached waypoint
          const distToWaypoint = Vector3.Distance(
            new Vector3(pos.x, 0, pos.z),
            new Vector3(data.nextWaypoint.x, 0, data.nextWaypoint.z)
          );

          if (distToWaypoint < waypointReachThreshold) {
            // Reached waypoint, generate a new one
            data.currentWaypoint = data.nextWaypoint.clone();
            data.nextWaypoint = generateWaypoint();
          }

          // Calculate direction to waypoint
          const toWaypoint = data.nextWaypoint.subtract(pos);
          toWaypoint.y = 0;
          const desiredDirection = toWaypoint.normalize();

          // Obstacle avoidance
          let avoidanceForce = Vector3.Zero();
          for (const obs of obstacleData) {
            const toObstacle = obs.position.subtract(pos);
            toObstacle.y = 0;
            const distToObstacle = toObstacle.length();

            if (distToObstacle < obs.radius + avoidanceRadius) {
              // Apply avoidance force (away from obstacle)
              const avoidDir = pos.subtract(obs.position);
              avoidDir.y = 0;
              avoidDir.normalize();
              const strength = 1.0 - (distToObstacle / (obs.radius + avoidanceRadius));
              avoidanceForce.addInPlace(avoidDir.scale(strength * 2));
            }
          }

          // Combine desired direction with avoidance
          const finalDirection = desiredDirection.add(avoidanceForce).normalize();

          // Update velocity
          data.velocity = finalDirection.scale(data.speed);

          // Move character
          const movement = data.velocity.clone();
          pos.addInPlace(movement);

          // Smoothly rotate parent to face movement direction
          if (finalDirection.length() > 0.01) { // Only rotate if actually moving
            const targetRotation = Math.atan2(finalDirection.x, finalDirection.z) + Math.PI;
            let currentRotation = data.mesh.rotation.y;

            // Normalize angles to -PI to PI
            while (currentRotation > Math.PI) currentRotation -= Math.PI * 2;
            while (currentRotation < -Math.PI) currentRotation += Math.PI * 2;

            let rotationDiff = targetRotation - currentRotation;
            while (rotationDiff > Math.PI) rotationDiff -= Math.PI * 2;
            while (rotationDiff < -Math.PI) rotationDiff += Math.PI * 2;

            // Smooth rotation (lerp)
            data.mesh.rotation.y += rotationDiff * 0.15;
          }

          // Boundary checking - keep characters inside
          const margin = 2;
          if (pos.x > halfArea - margin || pos.x < -halfArea + margin ||
              pos.z > halfArea - margin || pos.z < -halfArea + margin) {
            // Near boundary, steer back to center
            const toCenter = Vector3.Zero().subtract(pos);
            toCenter.y = 0;
            data.velocity = toCenter.normalize().scale(data.speed);

            // Also generate a new waypoint away from edges
            data.nextWaypoint = generateWaypoint();
          }

          // Hard clamp position (safety)
          pos.x = Math.max(-halfArea + 1, Math.min(halfArea - 1, pos.x));
          pos.z = Math.max(-halfArea + 1, Math.min(halfArea - 1, pos.z));
        });
        });

        // Store references for cleanup
        demoObjectsRef.current = {
          floor,
          walls,
          obstacles,
          moveObserver
        };

        // Clean up object URL if needed
        if (shouldRevokeUrl) {
          URL.revokeObjectURL(url);
        }
      }).catch((error) => {
        console.error('Error loading model for demo:', error);
        addDiagnostic(`ERROR loading model: ${error.message}`);
      });

      // Return cleanup function
      return () => {
        const { floor, walls, obstacles, moveObserver } = demoObjectsRef.current;

        if (moveObserver) {
          scene.onBeforeRenderObservable.remove(moveObserver);
        }

        // Stop all animations
        animationGroupsRef.current.forEach(anim => anim.stop());

        // Dispose all loaded meshes
        originalMeshesRef.current.forEach(mesh => mesh.dispose());
        originalMeshesRef.current = [];

        // Dispose instances
        demoInstancesRef.current.forEach(instance => instance.dispose());
        demoInstancesRef.current = [];

        // Dispose room and obstacles
        if (floor) floor.dispose();
        walls.forEach(wall => wall.dispose());
        obstacles.forEach(obstacle => obstacle.dispose());

        // Reset demo objects ref
        demoObjectsRef.current = { walls: [], obstacles: [] };

        // Reset lighting
        const hemiLight = scene.lights[0] as HemisphericLight;
        if (hemiLight) {
          hemiLight.intensity = 1.0;
        }
      };
    } else {
      // Exit demo mode - reload model for normal view
      if (originalMeshesRef.current.length === 0 && modelFile) {
        addDiagnostic(`✓ Exiting demo mode - reloading model for normal view`);

        // Load the model fresh
        const url = typeof modelFile === 'string' ? modelFile : URL.createObjectURL(modelFile);
        const shouldRevokeUrl = typeof modelFile !== 'string';

        SceneLoader.ImportMeshAsync('', '', url, scene, undefined, '.glb').then((result) => {
          const meshes = result.meshes;
          const animations = result.animationGroups;

          // Store references
          originalMeshesRef.current = meshes;

          // Stop all animations initially
          animations.forEach((anim) => anim.stop());

          // Filter to show walk and wave animations
          const safeAnimations: AnimationGroup[] = [];
          animations.forEach((anim) => {
            const name = (anim.name || '').toLowerCase();
            const isSafe = name.includes('wave') || name.includes('walk');
            if (isSafe) {
              safeAnimations.push(anim);
            }
          });

          animationGroupsRef.current = safeAnimations;

          // Center and scale model
          if (meshes.length > 0) {
            const bounds = meshes[0].getHierarchyBoundingVectors();
            const center = bounds.max.add(bounds.min).scale(0.5);
            const size = bounds.max.subtract(bounds.min);
            const maxDim = Math.max(size.x, size.y, size.z);

            camera.target = center;
            camera.radius = maxDim * 2;
            camera.alpha = Math.PI / 2;
            camera.beta = Math.PI / 3;

            // Restore normal camera zoom settings
            camera.wheelPrecision = 3; // Default sensitivity
            camera.lowerRadiusLimit = 0;
            camera.upperRadiusLimit = maxDim * 10;
          }

          setDiagnostics([]);
          onModelLoaded?.(safeAnimations, meshes);

          if (shouldRevokeUrl) {
            URL.revokeObjectURL(url);
          }
        }).catch((error) => {
          console.error('Error reloading model:', error);
          addDiagnostic(`ERROR reloading model: ${error.message}`);
        });
      }
    }
  }, [demoMode, modelFile]);

  return (
    <div className="relative w-full h-full">
      <canvas
        ref={canvasRef}
        className="w-full h-full outline-none"
        tabIndex={0}
      />
      {isLoading && (
        <div className="absolute inset-0 flex items-center justify-center bg-background/80">
          <div className="text-lg font-medium">Loading model...</div>
        </div>
      )}
      {diagnostics.length > 0 && demoMode && (
        <div className="absolute top-2 left-2 bg-black/80 text-white text-xs p-3 rounded max-w-md max-h-96 overflow-y-auto font-mono">
          <div className="font-bold mb-2">Diagnostic Log:</div>
          {diagnostics.map((msg, idx) => (
            <div key={idx} className="mb-1">{msg}</div>
          ))}
        </div>
      )}
    </div>
  );
}
