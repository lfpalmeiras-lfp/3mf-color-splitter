interface Props {
  onOpenFile: () => void;
}

const SOON = 'Em desenvolvimento';

export default function TopBar({ onOpenFile }: Props) {
  return (
    <header className="topbar">
      <div className="logo">
        <span className="logo-mark" aria-hidden="true" />
        3MF Color Splitter
      </div>
      <nav className="menu">
        <button onClick={onOpenFile}>Abrir 3MF</button>
        <button disabled title={SOON}>Editar</button>
        <button disabled title={SOON}>Visualizar</button>
        <button disabled title={SOON}>Exportar</button>
      </nav>
      <span className="unit-badge" title="Unidade interna do aplicativo">mm</span>
    </header>
  );
}
