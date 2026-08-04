import { Check, SunMoon } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import type { Theme } from '../model/types';
import { nextPrimaryTheme, THEME_DEFINITIONS, themeDefinition } from '../theme/themes';

interface Props {
  theme: Theme;
  onTheme(theme: Theme): void;
}

export function ThemeControl({ theme, onTheme }: Props) {
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  const definition = themeDefinition(theme);

  useEffect(() => {
    if (!open) return;
    const closeOutside = (event: PointerEvent) => {
      if (!rootRef.current?.contains(event.target as Node)) setOpen(false);
    };
    const closeEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setOpen(false);
    };
    window.addEventListener('pointerdown', closeOutside);
    window.addEventListener('keydown', closeEscape);
    return () => {
      window.removeEventListener('pointerdown', closeOutside);
      window.removeEventListener('keydown', closeEscape);
    };
  }, [open]);

  return <div className="theme-control" ref={rootRef}>
    <button
      className={open ? 'theme-trigger active' : 'theme-trigger'}
      type="button"
      aria-label={`Tema: ${definition.label}`}
      aria-expanded={open}
      title={`Tema: ${definition.label}. Clic para alternar; Alt + clic para elegir.`}
      onClick={event => {
        if (event.altKey) { setOpen(value => !value); return; }
        setOpen(false);
        onTheme(nextPrimaryTheme(theme));
      }}
    >
      <SunMoon size={17}/>
      <span className="theme-trigger-indicator" aria-hidden="true">
        {definition.palette.map(color => <i key={color} style={{ backgroundColor: color }}/>) }
      </span>
    </button>
    {open && <section className="theme-menu" role="menu" aria-label="Seleccionar tema visual">
      <header><span>ASPECTO DE BITWIRE</span><small>ALT + CLIC</small></header>
      <div className="theme-menu-grid">
        {THEME_DEFINITIONS.map(item => <button
          key={item.id}
          type="button"
          role="menuitemradio"
          aria-checked={item.id === theme}
          className={item.id === theme ? 'active' : ''}
          onClick={() => { onTheme(item.id); setOpen(false); }}
        >
          <span className="theme-swatch" aria-hidden="true">{item.palette.map(color => <i key={color} style={{ backgroundColor: color }}/>)}</span>
          <span><strong>{item.label}</strong><small>{item.description}</small></span>
          {item.id === theme && <Check size={14}/>} 
        </button>)}
      </div>
      <footer>El modo automático cambia a las 07:00, 17:00 y 21:00.</footer>
    </section>}
  </div>;
}
