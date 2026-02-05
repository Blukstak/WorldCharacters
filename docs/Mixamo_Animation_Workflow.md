# Mixamo Animation Workflow for Custom Characters

This document describes the complete process of applying Mixamo animations to custom Blender characters.

---

## Overview

Mixamo provides free motion-captured animations, but they're designed for Mixamo's specific bone structure. To use these animations on custom characters, you need to either:

1. **Use Mixamo's auto-rigger** to rig your character with Mixamo bones
2. **Transfer the Mixamo armature** to your character in Blender

This guide covers both approaches.

---

## Prerequisites

- Blender 5.x
- Mixamo account (free): https://www.mixamo.com
- Character mesh in T-pose (arms extended horizontally)

---

## Part 1: Preparing Your Character for Mixamo

### Export Requirements

Mixamo accepts: **FBX**, **OBJ**, or **ZIP** containing these formats.

**Critical:** Export **mesh only, without armature/rig**.

### Blender Export Steps

1. Open your character in Blender
2. Select only the mesh (not the armature)
3. Ensure the character is in **T-pose**:
   - Arms extended horizontally to the sides
   - Palms facing down or forward
   - Legs straight, slightly apart
4. Export:
   ```
   File → Export → FBX
   ```
5. Export settings:
   - **Selected Objects**: ✓ Enabled
   - **Object Types**: Mesh only (uncheck Armature)
   - **Apply Modifiers**: ✓ Enabled (bakes current pose)
   - **Forward**: -Z Forward
   - **Up**: Y Up

### Example Blender Python Export

```python
import bpy

# Select mesh only
bpy.ops.object.select_all(action='DESELECT')
mesh = bpy.data.objects.get('YourMeshName')
mesh.select_set(True)
bpy.context.view_layer.objects.active = mesh

# Export
bpy.ops.export_scene.fbx(
    filepath="C:/path/to/export/character_for_mixamo.fbx",
    use_selection=True,
    object_types={'MESH'},
    apply_scale_options='FBX_SCALE_ALL',
    axis_forward='-Z',
    axis_up='Y',
    use_mesh_modifiers=True,
    bake_anim=False
)
```

---

## Part 2: Mixamo Upload and Auto-Rigging

### Upload Process

1. Go to https://www.mixamo.com and sign in
2. Click **"Upload Character"**
3. Select your exported FBX/OBJ file
4. Wait for upload and processing

### Auto-Rigger Configuration

After upload, Mixamo shows the auto-rigger interface:

1. **Place markers** on your character:
   - Chin
   - Wrists (left and right)
   - Elbows (left and right)
   - Knees (left and right)
   - Groin

2. **Skeleton LOD** (Level of Detail):
   - **Standard**: Basic skeleton (recommended for most uses)
   - **With Fingers**: Includes finger bones

3. Click **"Next"** to process

4. **Preview** the rigged character - it should show a short animation

5. If satisfied, the character is now rigged and ready

---

## Part 3: Downloading from Mixamo

### Download the Rigged Character (Important!)

**Before downloading animations**, download your rigged character first:

1. With your character loaded, click **"Download"**
2. Settings:
   - **Format**: FBX Binary (.fbx)
   - **Pose**: T-pose
3. Save as: `character_rigged.fbx`

This gives you the character with Mixamo's bone structure.

### Download Animations

1. Browse or search for animations (e.g., "breakdance", "walk", "wave")
2. Select an animation
3. Adjust parameters:
   - **In Place**: ✓ (keeps character stationary - recommended)
   - **Trim**: Adjust start/end frames if needed
4. Click **"Download"**
5. Settings:
   - **Format**: FBX Binary (.fbx)
   - **Skin**: With Skin (includes mesh) or Without Skin (animation only)
   - **Frames per Second**: 30 (standard)
   - **Keyframe Reduction**: None (preserves all keyframes)
6. Save as: `animation_name.fbx`

---

## Part 4: Applying Animation in Blender

### Method A: Use Mixamo-Rigged Character Directly

If you downloaded the rigged character from Mixamo:

1. Import the rigged character FBX:
   ```
   File → Import → FBX
   ```

2. Import the animation FBX

3. Transfer the animation action:
   ```python
   import bpy

   # Get armatures
   character_arm = bpy.data.objects.get('YourCharacter_Armature')
   anim_arm = bpy.data.objects.get('Armature')  # From animation FBX

   # Get the action from animation armature
   action = anim_arm.animation_data.action

   # Assign to your character
   if not character_arm.animation_data:
       character_arm.animation_data_create()
   character_arm.animation_data.action = action

   # Blender 5: Bind the action slot
   slot = action.slots[0]
   character_arm.animation_data.action_slot_handle = slot.handle

   # Delete the animation armature (keep only the action)
   bpy.data.objects.remove(anim_arm, do_unlink=True)
   ```

### Method B: Transfer Mixamo Armature to Custom Character

If your character has a custom rig and you want to use Mixamo animations:

1. **Import the Mixamo animation FBX** (with skin):
   ```python
   import bpy
   bpy.ops.import_scene.fbx(filepath="C:/path/to/animation.fbx")
   ```

2. **Identify imported objects**:
   ```python
   mixamo_arm = None
   mixamo_mesh = None
   for obj in bpy.context.selected_objects:
       if obj.type == 'ARMATURE':
           mixamo_arm = obj
       elif obj.type == 'MESH':
           mixamo_mesh = obj
   ```

3. **Store the animation action**:
   ```python
   action = mixamo_arm.animation_data.action
   action.name = "MyAnimation"
   action.use_fake_user = True  # Prevents deletion when unused
   ```

4. **Prepare the Mixamo armature**:
   ```python
   # Clear animation temporarily
   mixamo_arm.animation_data.action = None

   # Reset to rest pose
   bpy.context.view_layer.objects.active = mixamo_arm
   bpy.ops.object.mode_set(mode='POSE')
   bpy.ops.pose.select_all(action='SELECT')
   bpy.ops.pose.rot_clear()
   bpy.ops.pose.loc_clear()
   bpy.ops.pose.scale_clear()
   bpy.ops.object.mode_set(mode='OBJECT')

   # Position at origin
   mixamo_arm.location = (0, 0, 0)
   ```

5. **Delete the Mixamo mesh** (we only need the armature):
   ```python
   if mixamo_mesh:
       bpy.data.objects.remove(mixamo_mesh, do_unlink=True)
   ```

6. **Prepare your custom character**:
   ```python
   your_mesh = bpy.data.objects.get('YourMeshName')
   old_armature = bpy.data.objects.get('YourOldArmature')

   # Remove old armature modifier
   for mod in list(your_mesh.modifiers):
       if mod.type == 'ARMATURE':
           your_mesh.modifiers.remove(mod)

   # Clear parent
   your_mesh.parent = None

   # Clear all vertex groups (will be regenerated)
   your_mesh.vertex_groups.clear()

   # Delete old armature
   bpy.data.objects.remove(old_armature, do_unlink=True)
   ```

7. **Re-parent with automatic weights**:
   ```python
   bpy.ops.object.select_all(action='DESELECT')
   your_mesh.select_set(True)
   mixamo_arm.select_set(True)
   bpy.context.view_layer.objects.active = mixamo_arm

   bpy.ops.object.parent_set(type='ARMATURE_AUTO')
   ```

8. **Apply the animation**:
   ```python
   mixamo_arm.animation_data.action = action

   # Blender 5: Bind action slot
   slot = action.slots[0]
   mixamo_arm.animation_data.action_slot_handle = slot.handle
   ```

---

## Part 5: Complete Script

Here's a complete script for Method B:

```python
import bpy

# === CONFIGURATION ===
ANIMATION_FBX = r"C:\path\to\mixamo_animation.fbx"
YOUR_MESH_NAME = "BaseHuman"
YOUR_OLD_ARMATURE_NAME = "HumanArmature"

def apply_mixamo_animation():
    # 1. Import Mixamo FBX
    bpy.ops.import_scene.fbx(filepath=ANIMATION_FBX)

    # 2. Find imported objects
    mixamo_arm = None
    mixamo_mesh = None
    for obj in bpy.context.selected_objects:
        if obj.type == 'ARMATURE':
            mixamo_arm = obj
        elif obj.type == 'MESH':
            mixamo_mesh = obj

    if not mixamo_arm:
        print("ERROR: No armature found in FBX")
        return

    # 3. Store animation
    action = mixamo_arm.animation_data.action
    action.name = "MixamoAnimation"
    action.use_fake_user = True

    # 4. Clear animation and reset pose
    mixamo_arm.animation_data.action = None
    bpy.context.view_layer.objects.active = mixamo_arm
    bpy.ops.object.mode_set(mode='POSE')
    bpy.ops.pose.select_all(action='SELECT')
    bpy.ops.pose.rot_clear()
    bpy.ops.pose.loc_clear()
    bpy.ops.pose.scale_clear()
    bpy.ops.object.mode_set(mode='OBJECT')
    mixamo_arm.location = (0, 0, 0)

    # 5. Delete Mixamo mesh
    if mixamo_mesh:
        bpy.data.objects.remove(mixamo_mesh, do_unlink=True)

    # 6. Prepare custom character
    your_mesh = bpy.data.objects.get(YOUR_MESH_NAME)
    old_arm = bpy.data.objects.get(YOUR_OLD_ARMATURE_NAME)

    if not your_mesh:
        print(f"ERROR: Mesh '{YOUR_MESH_NAME}' not found")
        return

    # Remove old armature modifier
    for mod in list(your_mesh.modifiers):
        if mod.type == 'ARMATURE':
            your_mesh.modifiers.remove(mod)

    your_mesh.parent = None
    your_mesh.vertex_groups.clear()

    if old_arm:
        bpy.data.objects.remove(old_arm, do_unlink=True)

    # 7. Re-parent with automatic weights
    bpy.ops.object.select_all(action='DESELECT')
    your_mesh.select_set(True)
    mixamo_arm.select_set(True)
    bpy.context.view_layer.objects.active = mixamo_arm
    bpy.ops.object.parent_set(type='ARMATURE_AUTO')

    # 8. Apply animation
    mixamo_arm.animation_data.action = action
    slot = action.slots[0]
    mixamo_arm.animation_data.action_slot_handle = slot.handle

    # 9. Rename armature
    mixamo_arm.name = f"{YOUR_MESH_NAME}_Armature"

    print(f"SUCCESS: Animation applied to {your_mesh.name}")
    print(f"Frame range: {action.frame_range}")

# Run
apply_mixamo_animation()
```

---

## Part 6: Adding More Animations (Quick Method)

Once your character is set up with a Mixamo armature, adding more animations is simple:

```python
import bpy

def add_mixamo_animation(fbx_path, action_name):
    """Add a new Mixamo animation to an existing Mixamo-rigged character"""

    # 1. Import the animation FBX
    bpy.ops.import_scene.fbx(filepath=fbx_path)

    # 2. Find imported armature
    imported_arm = None
    imported_mesh = None
    for obj in bpy.context.selected_objects:
        if obj.type == 'ARMATURE':
            imported_arm = obj
        elif obj.type == 'MESH':
            imported_mesh = obj

    # 3. Extract and rename the action
    action = imported_arm.animation_data.action
    action.name = action_name
    action.use_fake_user = True  # Protect from deletion

    # 4. Delete imported objects (keep only the action)
    bpy.ops.object.select_all(action='DESELECT')
    imported_arm.select_set(True)
    if imported_mesh:
        imported_mesh.select_set(True)
    bpy.ops.object.delete()

    print(f"Added: {action_name} ({action.frame_range[1]:.0f} frames)")
    return action

# Example usage:
add_mixamo_animation(r"C:\Downloads\Walking.fbx", "Walk")
add_mixamo_animation(r"C:\Downloads\Running.fbx", "Run")
add_mixamo_animation(r"C:\Downloads\Jumping.fbx", "Jump")
```

### Switching Between Animations

```python
import bpy

def switch_animation(armature_name, action_name):
    """Switch character to a different animation"""
    armature = bpy.data.objects.get(armature_name)
    action = bpy.data.actions.get(action_name)

    if armature and action:
        armature.animation_data.action = action
        # Blender 5: bind slot
        if len(action.slots) > 0:
            armature.animation_data.action_slot_handle = action.slots[0].handle

        # Update scene frame range to match animation
        bpy.context.scene.frame_start = int(action.frame_range[0])
        bpy.context.scene.frame_end = int(action.frame_range[1])

        print(f"Switched to: {action_name}")

# Example:
switch_animation("GreenGuy_Armature", "Walk")
```

---

## Part 7: Finding Actions in Blender UI

### Action Editor (Recommended)

1. Select the **armature** in the 3D viewport
2. Change any editor area to **Dope Sheet**
3. In the Dope Sheet header, change mode from "Dope Sheet" to **"Action Editor"**
4. The **action dropdown** appears at the top-left - click to see all animations

### Animation Workspace (Easiest)

1. Click the **"Animation"** tab at the top of Blender (next to Layout, Modeling, etc.)
2. The bottom panel is the Dope Sheet/Action Editor
3. The dropdown with all actions is in the top-left of that panel

### Properties Panel

1. Select the armature
2. Go to **Properties Panel** (right side) → **Object Data** tab (bone icon)
3. Scroll to **Animation** section
4. The action dropdown shows the current animation

---

## Part 8: Looping Animations

### Set Action to Cyclic

```python
import bpy

action = bpy.data.actions.get('Walk')
action.use_cyclic = True
```

### Scene Frame Range

**Important:** When switching animations, update the scene frame range:

```python
# Set scene to match animation length
action = bpy.data.actions.get('Walk')
bpy.context.scene.frame_start = int(action.frame_range[0])
bpy.context.scene.frame_end = int(action.frame_range[1])
```

If the frame range is wrong, animations will loop too fast or skip frames.

### Common Animation Lengths

| Animation Type | Typical Frames |
|---------------|----------------|
| Walk cycle | 24-40 |
| Run cycle | 16-24 |
| Idle | 60-120 |
| Wave | 15-30 |
| Jump | 20-40 |

---

## Troubleshooting

### Character appears broken/twisted after animation
- **Cause**: Bone orientations don't match
- **Solution**: Use Method B (transfer Mixamo armature with automatic weights)

### Animation doesn't play (character stays in T-pose)
- **Cause (Blender 5)**: Action slot not bound
- **Solution**: Set `animation_data.action_slot_handle = action.slots[0].handle`

### Mesh deforms incorrectly at joints
- **Cause**: Automatic weights didn't calculate well
- **Solution**: Manually paint weights or adjust in Weight Paint mode

### Character floats or sinks into ground
- **Cause**: Different origin points between armatures
- **Solution**: Adjust armature location or use "In Place" when downloading from Mixamo

### Animation loops too fast or skips frames
- **Cause**: Scene frame range doesn't match animation length
- **Solution**: Update scene frame range to match the action:
  ```python
  bpy.context.scene.frame_end = int(action.frame_range[1])
  ```

### Can't find actions/animations in Blender UI
- **Cause**: Looking in wrong place or armature not selected
- **Solution**:
  1. Select the armature first
  2. Use Animation workspace (top tabs)
  3. Look for dropdown in Dope Sheet → Action Editor mode

---

## Blender 5 Notes

Blender 5 introduced a new **layered action system**:

- Actions have **slots** that bind to specific objects
- You must bind the slot: `animation_data.action_slot_handle = slot.handle`
- FCurves are accessed via: `action.layers[0].strips[0].channelbags[0].fcurves`

---

## File Organization Recommendation

```
Project/
├── Assets/
│   ├── Characters/
│   │   ├── GreenGuy.blend
│   │   └── GreenGuy_for_mixamo.fbx
│   └── Animations/
│       ├── Breakdance.fbx
│       ├── Walk.fbx
│       └── Wave.fbx
└── docs/
    └── Mixamo_Animation_Workflow.md
```

---

## Resources

- Mixamo: https://www.mixamo.com
- Blender Manual - Animation: https://docs.blender.org/manual/en/latest/animation/
- Blender Python API: https://docs.blender.org/api/current/

