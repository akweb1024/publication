export default function SkeletonBlock({ height = 20 }: { height?: number }) {
  return <div className="skeleton-block" style={{ height }} aria-hidden="true" />;
}
