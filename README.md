# ArcadeGPU: Tank Pursuit

A high-performance 3D Tank Game built with the **ArcadeGPU** engine. This project features real-time Jolt Physics, custom 3D mesh rendering, and a nostalgic arcade aesthetic.

## 🚀 Engine Capabilities

- **High-Performance Rendering**: Leveraging modern GPU features via `ArcadeGPU` core.
- **Robust Physics**: Integrated Jolt Physics for vehicle dynamics and character movement.
- **Optimized Assets**: Uses the `.jsm` (JSON Static Mesh) format for fast, asynchronous model loading.
- **Retro Aesthetic**: Built-in pixelation shaders and arcade-style visual effects.

## 📁 Directory Structure

```text
/
├── arcadegpu-code/          # Core Engine Library
│   ├── src/lib/             # Engine Source (gfx3, jolt, input, etc.)
│   └── public/              # Core Assets (WASMs, standard textures)
├── components/
│   ├── App/                 # Main Application Components
│   │   ├── game/            # Game Entities (Tank, Player, Enemy)
│   │   └── App.tsx          # Main Game Screen Logic
│   ├── Core/                # UI Design System Components
│   └── Package/             # Complex UI Modules
├── PROJECT_MAP.md           # Architectural Overview
├── CHANGELOG.md             # Version History
└── README.md                # You are here
```

## 🛠 Developer Handoff Guide

### Key Systems

1.  **Input Handling**: Centralized in `inputManager`. Actions are registered in `GameScreen.onEnter()`.
2.  **Entity Lifecycle**:
    -   `constructor()`: Setup physics bodies and load JSM meshes.
    -   `update(ts)`: Handle logic, move physics bodies, and sync mesh positions.
    -   `draw()`: Submit meshes to the `gfx3MeshRenderer`.
3.  **Model Loading**: Transitioning from procedural boxes to `.jsm` files in `/models`.

### Adding New Entities

1.  Create a class that inherits from `Gfx3Drawable` if rendering is complex, or simply manages a collection of `Gfx3Mesh`.
2.  Register a physics body in `gfx3JoltManager`.
3.  Implement an `update` method that reads physics state and updates visual transforms.

## ⚙️ Build and Run

1.  Ensure all dependencies are installed via `npm install`.
2.  Run the development server with `npm run dev`.
3.  Navigate to `localhost:3000` to play.

## 🗺 Documentation
- [Project Map](./PROJECT_MAP.md)
- [Changelog](./CHANGELOG.md)
- [Design System Guide](./COMPONENTS_GUIDE.md)
