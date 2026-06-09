# PDX Surveillance Platform — Frontend

React + TypeScript SPA powering the PDX Surveillance Platform dashboard.

## Tech Stack

- **React 19** with TypeScript
- **Vite** — build tool & dev server
- **TailwindCSS 3** — utility-first styling
- **React Router 7** — client-side routing
- **TanStack Query** — server state management
- **Recharts** — data visualization & charts
- **Three.js / React Three Fiber** — 3D globe visualization
- **ArcGIS JS SDK** — geospatial maps
- **Framer Motion** — animations
- **Lucide React** — icon library

## Setup

```bash
# Install dependencies
npm install

# Start dev server (http://localhost:5173)
npm run dev
```

## Scripts

| Command              | Description                                |
|----------------------|--------------------------------------------|
| `npm run dev`        | Start Vite dev server with HMR             |
| `npm run build`      | Type-check + production build              |
| `npm run preview`    | Preview production build locally           |
| `npm run lint`       | Run ESLint                                 |
| `npm run test`       | Run unit tests (Vitest)                    |
| `npm run test:watch` | Run tests in watch mode                    |
| `npm run test:unit`  | Run unit tests only (no integration)       |
| `npm run test:integration` | Run API integration tests            |

## Project Structure

```
src/
├── components/        # Shared/reusable UI components
├── pages/             # Page-level components
│   ├── alertsPage/    # Alert tracking & triage
│   ├── hdis/          # Health Data Intelligence System
│   ├── outbreak/      # Outbreak workspace
│   ├── overview/      # Overview dashboard
│   ├── readiness/     # Disease preparedness
│   ├── predictions/   # Prediction models
│   ├── stardata/      # STAR risk assessments
│   ├── sitrep/        # Situation reports
│   ├── supplierForm/  # Supplier registration
│   └── ...
├── services/          # API client & service layer
├── types/             # TypeScript type definitions
└── utils/             # Helper functions
```

## Environment

The frontend connects to the Django backend API. In development, Vite proxies API requests. See `vite.config.ts` for proxy configuration.
