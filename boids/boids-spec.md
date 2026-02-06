# Boids Lab - Project Specification

An interactive flocking simulation based on Craig Reynolds' Boids algorithm, featuring a pink space aesthetic with twinkling stars.

## Overview

**File:** `boids.html`
**Type:** Single-file HTML5 Canvas application
**Dependencies:** None (vanilla JavaScript)

## Core Algorithm

The simulation implements the classic three rules of flocking behavior:

| Rule | Description | Parameter |
|------|-------------|-----------|
| **Separation** | Boids steer to avoid crowding nearby flockmates | `separation` (0 - 0.2) |
| **Alignment** | Boids steer toward the average heading of nearby flockmates | `alignment` (0 - 0.2) |
| **Cohesion** | Boids steer toward the average position of nearby flockmates | `cohesion` (0 - 0.02) |

### Additional Behaviors

- **Obstacle Avoidance** - Boids steer around circular obstacles
- **Mouse Interaction** - Boids can be attracted to or repelled from the cursor
- **Boundary Handling** - Bounce (turn at edges) or Wrap (toroidal space)

## Features

### UI Controls

#### Flocking Parameters (Sliders)
| Control | Range | Default | Description |
|---------|-------|---------|-------------|
| Separation | 0 - 0.2 | 0.05 | Avoidance strength |
| Alignment | 0 - 0.2 | 0.05 | Direction matching strength |
| Cohesion | 0 - 0.02 | 0.005 | Grouping strength |
| Neighbor Radius | 20 - 200 | 75 | Detection range (pixels) |
| Max Speed | 1 - 10 | 4 | Maximum velocity |

#### Behavior Presets
| Preset | Separation | Alignment | Cohesion | Radius | Speed | Effect |
|--------|------------|-----------|----------|--------|-------|--------|
| Schooling | 0.03 | 0.12 | 0.008 | 100 | 4 | Synchronized fish-like movement |
| Chaotic | 0.08 | 0.01 | 0.002 | 40 | 6 | Erratic insect-like swarms |
| Cluster | 0.04 | 0.03 | 0.015 | 120 | 3 | Tight gravitational grouping |

#### Playback Controls
- **Pause/Resume** - Freeze/unfreeze simulation
- **Reset** - Reinitialize with 150 boids and 2 obstacles
- **+ 10 Boids** - Add 10 boids at random positions
- **- 10 Boids** - Remove 10 boids

#### Boundary Modes
- **Bounce** - Boids turn away from edges (default)
- **Wrap** - Boids teleport to opposite edge (toroidal)

#### Mouse Interaction Modes
- **Off** - No mouse influence
- **Attract** - Boids drawn toward cursor (default)
- **Repel** - Boids flee from cursor (predator simulation)

#### Obstacle Controls
- **Enable/Disable** - Toggle obstacle avoidance
- **+ Add** - Add obstacle at random position
- **Clear All** - Remove all obstacles

#### Visual Settings
- **Motion Trails** - Toggle trail effect (on/off)
- **Trail Length** - Adjust trail fade rate (0.02 - 0.5)
- **Theme** - Minimal (pink), Neon, or Nature

### Live Statistics
| Stat | Description |
|------|-------------|
| FPS | Frames per second (updated every 500ms) |
| Boids | Current boid count |
| Avg Speed | Mean velocity magnitude |
| Avg Neighbors | Mean neighbor count per boid |

### Mouse Interactions (Canvas)
| Action | Effect |
|--------|--------|
| Click | Spawn new boid at cursor |
| Shift+Click | Place new obstacle at cursor |
| Drag obstacle | Reposition obstacle |

## Visual Design

### Color Scheme (Minimal/Pink Theme)
| Element | Color |
|---------|-------|
| Background | `#0d0d1a` (dark space) |
| Control Panel | `rgba(60, 20, 40, 0.95)` (rose) |
| Text | `#ffd9e6` (light pink) |
| Accent | `#ff69b4` (hot pink) |
| Boids | `#ffb6c1` (light pink) |
| Obstacles | `#ff69b4` (hot pink) |
| Mouse Radius | `#ff82ab` (medium pink) |
| Stars | Pastel pink variations |

### Starfield
- 200 twinkling stars
- 4 pastel pink color variations
- Variable sizes (0.5 - 2.5 pixels)
- Sinusoidal twinkle animation
- Glow effect on larger stars

### Boid Rendering
- Arrow/chevron shape pointing in direction of travel
- Size: 15px length
- Rotation aligned to velocity vector

## Technical Details

### Classes

#### `Boid`
```javascript
constructor(x, y)     // Position (random if not provided)
separation()          // Apply separation rule
alignment()           // Apply alignment rule
cohesion()            // Apply cohesion rule
avoidObstacles()      // Steer around obstacles
followMouse()         // React to mouse position
limitSpeed()          // Clamp velocity to min/max
handleBoundary()      // Wrap or bounce at edges
update()              // Run all behaviors
draw()                // Render to canvas
getSpeed()            // Return velocity magnitude
```

#### `Star`
```javascript
constructor()         // Random position, size, color, twinkle params
draw(time)            // Render with twinkle effect
```

#### `Obstacle`
```javascript
constructor(x, y, radius)
draw()                // Render circle with border
contains(x, y)        // Hit test for dragging
```

### Performance
- O(n²) neighbor checks (suitable for ~150-300 boids)
- 60 FPS target with requestAnimationFrame
- Canvas 2D rendering

### Browser Support
- Modern browsers with ES6+ support
- Canvas 2D API
- CSS custom properties (variables)

## File Structure

```
boids.html
├── <style>           CSS (289 lines)
│   ├── CSS variables for theming
│   ├── Control panel layout
│   ├── Slider/button styling
│   └── Responsive canvas
├── <body>            HTML structure
│   ├── #controls     Side panel (320px)
│   ├── #canvas-container
│   └── .tooltip      Hover tooltips
└── <script>          JavaScript (~600 lines)
    ├── State management
    ├── Class definitions
    ├── Control functions
    ├── Event handlers
    └── Animation loop
```

## Usage

1. Open `boids.html` in a modern web browser
2. Adjust sliders to modify flocking behavior
3. Click presets for instant behavior changes
4. Use mouse to attract/repel boids
5. Add obstacles for navigation challenges
6. Experiment with themes and visual settings

## Future Enhancements (Not Implemented)

- Perception cone (field-of-view limiting)
- Leader/predator boids
- Heterogeneous species
- Spatial partitioning for O(n) performance
- Web Workers for off-thread updates
- Live charting of metrics
- Preset export/import via URL
