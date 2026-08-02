export interface StatusCardProps {
  detail: string;
  status: string;
  title: string;
}

export function StatusCard({ detail, status, title }: StatusCardProps) {
  return (
    <section className="status-card" aria-labelledby="status-card-title">
      <div className="status-card-heading">
        <h2 id="status-card-title">{title}</h2>
        <span className="status-pill" role="status">
          {status}
        </span>
      </div>
      <p>{detail}</p>
    </section>
  );
}
