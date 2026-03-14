# Create Page

Scaffold a new page following the raise-app design system and architecture patterns.

## Arguments
$ARGUMENTS — Required: page name and purpose (e.g., "competitors - track and analyze competing bids")

## Template

Every page follows this structure:

```tsx
'use client';

import { useState, useEffect, useCallback } from 'react';
import { /* icons */ } from 'lucide-react';
import { useToast } from '@/components/toast';

// Types specific to this page
interface PageData { /* ... */ }

export default function PageName() {
  const { toast } = useToast();
  const [data, setData] = useState<PageData[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/endpoint');
      if (res.ok) setData(await res.json());
    } catch { /* handle */ }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { fetchData(); }, [fetchData]);

  if (loading) return <LoadingSkeleton />;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-6)' }}>
      {/* Header with icon + title + subtitle */}
      {/* Stats row (if applicable) */}
      {/* Main content */}
    </div>
  );
}
```

## Design Rules
1. All colors via `var(--*)` design tokens — zero Tailwind color classes
2. Header: icon in accent-muted circle + page title (font-size-2xl, weight 700) + subtitle (font-size-sm, text-muted)
3. Stats row: grid of metric cards using the card class
4. Tables: use `.table-header` and `.table-row` classes
5. Buttons: use `.btn .btn-primary`, `.btn .btn-secondary`, `.btn .btn-sm`
6. Loading: skeleton divs with `.skeleton` class
7. Empty states: centered icon + helpful message + action button
8. All hover states via onMouseEnter/onMouseLeave

## Process
1. Parse the page name and purpose from arguments
2. Create the page file at `src/app/{name}/page.tsx`
3. Create the API route at `src/app/api/{name}/route.ts` if needed
4. Add database table in `src/lib/db.ts` if needed
5. Add to sidebar navigation in `src/components/sidebar.tsx`
6. Verify build passes
7. Log execution to `.claude/skills-state/execution-log.jsonl`:
   ```json
   {"timestamp":"ISO","skill":"page","version":1,"trigger":"manual|improve-cycle-N","outcome":"success|partial|failure","build_result":"pass|fail","findings_count":N,"changes_made":N,"changes_reverted":0,"type_errors_introduced":0,"rework_needed":false,"notes":"summary"}
   ```
