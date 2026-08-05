import { Code2, ExternalLink, Info, Laptop, X } from 'lucide-react';

interface Props { onClose(): void; onOffline(): void }

const PORTRAIT = 'https://alejandropico.github.io/Portfolio/CV/Alejandro%20Pico.svg?v=20260707';

export function AboutDialog({ onClose, onOffline }: Props) {
  return <div className="modal-backdrop" onMouseDown={onClose}>
    <section className="about-dialog" onMouseDown={event=>event.stopPropagation()} aria-label="Acerca de BitWire">
      <header>
        <img src="./favicon.svg" alt=""/>
        <div><span className="eyebrow">ACERCA DEL PROYECTO</span><h2>BitWire</h2><p>Laboratorio vectorial de circuitos</p></div>
        <button className="dialog-close" onClick={onClose} aria-label="Cerrar"><X size={19}/></button>
      </header>
      <div className="about-body">
        <aside><img src={PORTRAIT} alt="Alejandro Pico"/><span>ALEJANDRO PICO PEREZ</span></aside>
        <article>
          <Info size={19}/>
          <h3>Diseñar, simular y comprender</h3>
          <p>BitWire es un proyecto personal de Alejandro Pico: un entorno para construir circuitos eléctricos, electrónicos y digitales, observar su funcionamiento y profundizar desde el esquema hasta la estructura interna de sus componentes.</p>
          <p>La aplicación combina un lienzo multiescala, simulación, encapsulados jerárquicos, instrumentación profesional y un catálogo extensible. El código es público y el proyecto evoluciona de forma continua.</p>
          <div className="about-links">
            <a href="https://github.com/AlejandroPico/BitWire" target="_blank" rel="noreferrer"><Code2 size={17}/><span><strong>Repositorio de BitWire</strong><small>Código, historial y versiones</small></span><ExternalLink size={14}/></a>
            <a href="https://alejandropico.github.io/Portfolio/" target="_blank" rel="noreferrer"><img src={PORTRAIT} alt=""/><span><strong>Portfolio de Alejandro</strong><small>Perfil y otros proyectos</small></span><ExternalLink size={14}/></a>
          </div>
          <button className="about-offline" onClick={()=>{onClose();onOffline();}}><Laptop size={17}/><span>Descargar aplicación portable</span></button>
        </article>
      </div>
      <footer><span>MIT · © 2026 Alejandro Pico Perez</span><span>WEB + ESCRITORIO</span></footer>
    </section>
  </div>;
}
