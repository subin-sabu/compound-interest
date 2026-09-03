import { useState } from "react";
import QuoteForm from "./components/QuoteForm";
import QuotePreview from "./components/QuotePreview";
import calculateFundGrowth from "./utils/calculateFundGrowth";

function App() {
  const [quote, setQuote] = useState(null);

  const handleGenerate = (values) => {
    const result = calculateFundGrowth(values);

    setQuote(result);
  };

  return (
    <div className="min-h-screen bg-gray-100 py-10 px-5">

      <div className="max-w-7xl mx-auto">

        {!quote ? (
          <div className="flex justify-center">
            <QuoteForm onGenerate={handleGenerate} />
          </div>
        ) : (
          <div>

            {/* Back */}
            <div className="mb-6 flex justify-center">
              <button
                onClick={() => setQuote(null)}
                className="px-5 py-2 bg-white border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50"
              >
                ← Edit Quote
              </button>
            </div>

            {/* Preview */}
            <QuotePreview quote={quote} />

          </div>
        )}

      </div>

    </div>
  );
}

export default App;