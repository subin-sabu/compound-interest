import { useState } from "react";

function QuoteForm({ onGenerate }) {
  const [premium, setPremium] = useState("");
  const [ppt, setPpt] = useState("");
  const [pt, setPt] = useState("");
  const [cagr, setCagr] = useState("");

  const handleSubmit = (e) => {
    e.preventDefault();

    const premiumValue = Number(premium);
    const pptValue = Number(ppt);
    const ptValue = Number(pt);
    const cagrValue = Number(cagr);

    if (!premiumValue || !pptValue || !ptValue || !cagrValue) {
      return;
    }

    if (pptValue > ptValue) {
      alert("Premium Paying Term cannot be greater than Policy Term.");
      return;
    }

    onGenerate({
      premium: premiumValue,
      ppt: pptValue,
      pt: ptValue,
      cagr: cagrValue,
    });
  };

  return (
    <div className="w-full max-w-xl">
      <div className="bg-white rounded-3xl shadow-2xl overflow-hidden border border-gray-100">

        {/* Header */}
        <div className="bg-gradient-to-r from-blue-800 to-blue-600 px-8 py-8 text-center">
          <h1 className="text-4xl font-extrabold text-white">
            Investment Quote Generator
          </h1>

          <p className="text-blue-100 mt-2">
            Generate a basic investment illustration instantly.
          </p>
        </div>

        {/* Form */}
        <form
          onSubmit={handleSubmit}
          className="p-8 space-y-6"
        >

          {/* Annual Premium */}
          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-2">
              Annual Premium (₹)
            </label>

            <input
              type="number"
              min="1"
              required
              value={premium}
              onChange={(e) => setPremium(e.target.value)}
              placeholder="100000"
              className="w-full rounded-xl border border-gray-300 px-4 py-3 text-lg focus:outline-none focus:ring-4 focus:ring-blue-200 focus:border-blue-600 transition"
            />

            {premium && (
              <p className="mt-2 text-sm font-semibold text-blue-700 bg-blue-50 border border-blue-200 rounded-lg px-3 py-2">
                ₹{Number(premium).toLocaleString("en-IN")} per year
              </p>
            )}
          </div>

          {/* PPT & Policy Term */}
          <div className="grid grid-cols-2 gap-5">

            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-2">
                PPT (Years)
              </label>

              <input
                type="number"
                min="1"
                max="40"
                required
                value={ppt}
                onChange={(e) => setPpt(e.target.value)}
                placeholder="10"
                className="w-full rounded-xl border border-gray-300 px-4 py-3 text-lg focus:outline-none focus:ring-4 focus:ring-blue-200 focus:border-blue-600 transition"
              />
            </div>

            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-2">
                Policy Term
              </label>

              <input
                type="number"
                min="1"
                max="60"
                required
                value={pt}
                onChange={(e) => setPt(e.target.value)}
                placeholder="40"
                className="w-full rounded-xl border border-gray-300 px-4 py-3 text-lg focus:outline-none focus:ring-4 focus:ring-blue-200 focus:border-blue-600 transition"
              />
            </div>

          </div>

          {/* CAGR */}
          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-2">
              Projected CAGR (%)
            </label>

            <input
              type="number"
              min="0.01"
              step="0.01"
              required
              value={cagr}
              onChange={(e) => setCagr(e.target.value)}
              placeholder="15"
              className="w-full rounded-xl border border-gray-300 px-4 py-3 text-lg focus:outline-none focus:ring-4 focus:ring-blue-200 focus:border-blue-600 transition"
            />
          </div>

          {/* Button */}
          <button
            type="submit"
            className="w-full bg-gradient-to-r from-green-600 to-emerald-500 hover:from-green-700 hover:to-emerald-600 text-white font-bold text-lg py-4 rounded-xl shadow-lg transition duration-300 hover:scale-[1.02] active:scale-100"
          >
            Generate Quote
          </button>

        </form>
      </div>

      <p className="text-center text-gray-500 mt-6 text-sm">
        Compound Interest Illustration Generator
      </p>
    </div>
  );
}

export default QuoteForm;