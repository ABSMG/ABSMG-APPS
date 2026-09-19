interface SearchViewProps {
  onTriggerAction?: (text: string) => void;
  preferredLanguage?: string;
}

export function SearchView({
  onTriggerAction,
  preferredLanguage = 'en',
}: SearchViewProps) {
  const [query, setQuery] = useState('');
  const [result, setResult] = useState<SearchResult | null>(null);
  const [loading, setLoading] = useState(false);

  const submitSearch = async (
    event: React.FormEvent
  ) => {
    event.preventDefault();

    const value = query.trim();

    if (!value || loading) return;

    setLoading(true);
    setResult(null);

    try {
      const response = await fetch(
        '/api/ai/search',
        {
          method: 'POST',
          headers: {
            'Content-Type':
              'application/json',
          },
          body: JSON.stringify({
            query: value,
            language:
              preferredLanguage,
          }),
        }
      );

      const data =
        await response.json();

      if (!response.ok) {
        throw new Error(
          data?.error ||
            'Search failed.'
        );
      }

      setResult(data);
    } catch (error: any) {
      setResult({
        query: value,
        summary:
          error?.message ||
          'Search is temporarily unavailable.',
        verifiedFacts: [],
        estimates: [],
        uncertainties: [
          'The search service could not complete this request.',
        ],
        sources: [],
        suggestedActions: [],
      });
    } finally {
      setLoading(false);
    }
  };
