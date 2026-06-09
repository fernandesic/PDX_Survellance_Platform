import type { CategoryBarDatum, CategoryCounts, IhmrefCategory, IhmrefCountryIncident, TimelineByYear } from "@/pages/ihmref/types/ihmref";
import { CategoryBarChart } from "./CategoryBarChart";
import { Timeline } from "./Timeline";

export const CountryIHRPage = ({
  incidents,
}: {
  incidents: IhmrefCountryIncident[];
}) => {
  const uniqueEvents = deduplicateIncidents(incidents);
//   const uniqueEvents = incidents
  const timeline = sortTimeline(groupIncidentsByYear(uniqueEvents));
  const counts = buildCategoryCounts(uniqueEvents);

  const barChartData = Object.entries(counts).map(
    ([category, count]) => ({
      category: category as IhmrefCategory,
      count: count ?? 0,
    })
  );

  return (
    <div className="space-y-10">
      <section>
        <h2 className="text-xl font-semibold text-slate-100 mb-4">
          Activity Distribution by Category
        </h2>
        <CategoryBarChart data={barChartData} />
      </section>

      <section>
        <h2 className="text-xl font-semibold text-slate-100 mb-4">
          Activity Timeline
        </h2>
        <Timeline timeline={timeline} />
      </section>
    </div>
  );
};


const deduplicateIncidents = (
      data: IhmrefCountryIncident[]
    ): IhmrefCountryIncident[] => {
      const seen = new Set<string>();

      return data.filter(item => {
        const key = [
          item.ihmref_data.category,
          item.incident,
          item.start_date,
          item.end_date,
        ].join("|");

        if (seen.has(key)) return false;
        seen.add(key);
        return true;
      });
    };

    const groupIncidentsByYear = (
    incidents: IhmrefCountryIncident[]
    ): TimelineByYear => {
    return incidents.reduce<TimelineByYear>((acc, item) => {
        // Skip if start_date or end_date is missing
        if (!item.start_date || !item.end_date) return acc;

        const year = new Date(item.start_date).getFullYear();
        acc[year] ??= [];
        acc[year].push(item);
        return acc;
    }, {});
    };

    const sortTimeline = (timeline: TimelineByYear): TimelineByYear => {
    Object.values(timeline).forEach(events =>
        events.sort(
        (a, b) =>
            new Date(a.start_date).getTime() - new Date(b.start_date).getTime()
        )
    );

    return timeline;
    };


    const buildCategoryCounts = (
      incidents: IhmrefCountryIncident[]
    ): Partial<CategoryCounts> => {
      return incidents.reduce<Partial<CategoryCounts>>((acc, item) => {
        const category = item.ihmref_data.category;
        acc[category] = (acc[category] ?? 0) + 1;
        return acc;
      }, {});
    };

    const toCategoryBarData = (
      counts: Partial<CategoryCounts>
    ): CategoryBarDatum[] =>
      Object.entries(counts).map(([category, count]) => ({
        category: category as IhmrefCategory,
        count: count ?? 0,
      }));