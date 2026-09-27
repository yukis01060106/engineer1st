import { ReactNode } from "react";

export function PageHeader({
  eyebrow,
  title,
  description,
  actions,
}: {
  eyebrow: string;
  title: string;
  description?: ReactNode;
  actions?: ReactNode;
}) {
  return (
    <header className="page-head">
      <div className="spread">
        <span className="eyebrow">{eyebrow}</span>
        {actions}
      </div>
      <h1>{title}</h1>
      {description && <p className="page-desc">{description}</p>}
    </header>
  );
}
