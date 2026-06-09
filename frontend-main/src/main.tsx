import { createRoot } from 'react-dom/client'
import './index.css'
import '@arcgis/core/assets/esri/themes/dark/main.css'
import App from './App.tsx'
import { BrowserRouter } from "react-router-dom";
import ScreenBlock from './components/ScreenBlock.tsx'

createRoot(document.getElementById('root')!).render(
  // <StrictMode>
  <BrowserRouter>
    <ScreenBlock>
      <App />
    </ScreenBlock>
  </BrowserRouter>
  // </StrictMode>,
)
