import { Apple, CheckCircle2, Download, Laptop, MonitorDown, PackageCheck, ShieldCheck, TerminalSquare, X } from 'lucide-react';
import { recommendedDesktopDownload, type DesktopDownload } from '../utils/offlineDownloads';

interface Props { onClose(): void }

export function OfflineDialog({ onClose }: Props) {
  const { detectedPlatform, downloads, recommended } = recommendedDesktopDownload();
  return <div className="modal-backdrop" onMouseDown={onClose}>
    <section className="offline-dialog" onMouseDown={event=>event.stopPropagation()} aria-label="Descargar BitWire offline">
      <header>
        <div className="offline-title-icon"><MonitorDown size={23}/></div>
        <div><span className="eyebrow">APLICACIÓN DE ESCRITORIO</span><h2>BitWire en modo offline</h2></div>
        <button className="dialog-close" onClick={onClose} aria-label="Cerrar"><X size={19}/></button>
      </header>
      <div className="offline-intro">
        <div><Laptop size={32}/><span><strong>Un archivo. Sin instalación.</strong><small>El editor, el catálogo y el motor viajan dentro del paquete.</small></span></div>
        <p>La versión portable abre BitWire en una ventana propia y conserva los proyectos localmente. No necesita comandos, Node.js, Python ni conexión a Internet para trabajar.</p>
      </div>
      {recommended ? <RecommendedDownload item={recommended}/> : <div className="platform-unknown"><TerminalSquare size={19}/><span>No se ha podido identificar un sistema de escritorio. Elige un paquete de la lista.</span></div>}
      <div className="offline-features">
        <span><PackageCheck size={16}/><b>Dependencias incluidas</b></span>
        <span><ShieldCheck size={16}/><b>Sin instalador</b></span>
        <span><CheckCircle2 size={16}/><b>Mismos proyectos .bitwire</b></span>
      </div>
      <section className="platform-list">
        <header><span>OTROS SISTEMAS</span><small>{detectedPlatform === 'unknown' ? 'SELECCIÓN MANUAL' : 'PAQUETES ALTERNATIVOS'}</small></header>
        {downloads.filter(item=>item.url!==recommended?.url).map(item=><a key={item.platform} href={item.url}>
          <PlatformIcon item={item}/><span><strong>{item.label}</strong><small>{item.note}</small></span><Download size={16}/>
        </a>)}
      </section>
      <footer>
        <p>Cada sistema operativo requiere su propio paquete. GitHub Actions los compila previamente para que el ordenador solo tenga que abrirlos.</p>
        <a href="https://github.com/AlejandroPico/BitWire/releases" target="_blank" rel="noreferrer">Ver todas las versiones</a>
      </footer>
    </section>
  </div>;
}

function RecommendedDownload({ item }: { item: DesktopDownload }) {
  return <a className="recommended-download" href={item.url}>
    <span className="recommended-platform"><PlatformIcon item={item}/></span>
    <span><small>RECOMENDADO PARA ESTE EQUIPO</small><strong>Descargar para {item.label}</strong><em>{item.filename}</em></span>
    <Download size={21}/>
  </a>;
}

function PlatformIcon({ item }: { item: DesktopDownload }) {
  if (item.platform === 'macos') return <Apple size={20}/>;
  if (item.platform === 'linux') return <TerminalSquare size={20}/>;
  return <Laptop size={20}/>;
}
