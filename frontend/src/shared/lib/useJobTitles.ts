import { useEffect, useState } from 'react';
import { apiGet } from '@/shared/lib/api';
import type { Colleague } from '@/modules/team-chat/types';

export interface JobTitleMaps {
  byId: Map<string, string>;
  byName: Map<string, string>;
}

const EMPTY: JobTitleMaps = { byId: new Map(), byName: new Map() };

let cached: Promise<JobTitleMaps> | null = null;

function loadJobTitles(): Promise<JobTitleMaps> {
  if (!cached) {
    cached = (async () => apiGet<Colleague[]>('/v1/team-chat/colleagues/'))()
      .then((rows) => {
        const byId = new Map<string, string>();
        const byName = new Map<string, string>();
        for (const c of rows ?? []) {
          const title = c.job_title?.trim();
          if (!title) continue;
          byId.set(c.id, title);
          const name = c.full_name?.trim();
          if (name) byName.set(name, title);
        }
        return { byId, byName };
      })
      .catch(() => EMPTY);
  }
  return cached;
}

/** Job titles of colleagues, keyed by user id and by trimmed full name. Fetched once per session. */
export function useJobTitles(): JobTitleMaps {
  const [maps, setMaps] = useState<JobTitleMaps>(EMPTY);
  useEffect(() => {
    let alive = true;
    loadJobTitles().then((m) => {
      if (alive) setMaps(m);
    });
    return () => {
      alive = false;
    };
  }, []);
  return maps;
}
