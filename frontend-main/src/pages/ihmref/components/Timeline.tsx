import { CATEGORY_COLORS, type IhmrefCategory, type IhmrefCountryIncident, type TimelineByYear } from "@/pages/ihmref/types/ihmref";

export const Timeline = ({
  timeline,
}: {
  timeline: TimelineByYear;
}) => {
  const years = Object.keys(timeline)
    .map(Number)
    .sort((a, b) => b - a);

  return (
    <div className="space-y-6">
      {years.map(year => (
        <div key={year} className="border border-red-500 rounded-xl bg-black/10">
          <details>
            <summary className="cursor-pointer px-4 py-3 font-semibold text-slate-200">
              {year} • {timeline[year].length} activities
            </summary>

            <div className="p-4 space-y-3">
              {timeline[year].map(event => (
                <EventCard key={event.id} event={event} />
              ))}
            </div>
          </details>
        </div>
      ))}
    </div>
  );
};


const formatDate = (d: string) =>
  new Date(d).toLocaleDateString(undefined, {
    day: "numeric",
    month: "short",
    year: "numeric",
  });

const CategoryBadge = ({ category }: { category: IhmrefCategory }) => (
  <span
    className="px-2 py-1 rounded text-xs font-medium"
    style={{
      backgroundColor: CATEGORY_COLORS[category] + "22",
      color: CATEGORY_COLORS[category],
    }}
  >
    {category.replaceAll("_", " ").toUpperCase()}
  </span>
);

const EventCard = ({
  event,
}: {
  event: IhmrefCountryIncident;
}) => (
  <div className="p-4 rounded-lg bg-black/30">
    <div className="flex items-center justify-between mb-2">
      <CategoryBadge category={event.ihmref_data.category} />
      <span className="text-xs text-gray-300">
        {formatDate(event.start_date)} – {formatDate(event.end_date)}
      </span>
    </div>

    <h4 className="text-slate-100 font-medium text-sm">
      {event.incident}
    </h4>
  </div>
);
