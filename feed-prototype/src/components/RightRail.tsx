import AppliedFiltersSummary from './AppliedFiltersSummary';
import FollowShortcuts from './FollowShortcuts';

/**
 * Desktop right rail: contextual panels next to the center feed (v0.2.0).
 *
 * `AppliedFiltersSummary` self-hides when the URL has no active post filters,
 * so it only appears on the feed/browse routes that use them. Follow shortcuts
 * are always shown as persistent navigation context.
 */
export default function RightRail() {
  return (
    <div className="space-y-5">
      <AppliedFiltersSummary />
      <FollowShortcuts />
    </div>
  );
}
