export default function Home() {
  return (
    <main className="min-h-screen bg-slate-50 px-4 py-12">
      <div className="mx-auto flex min-h-[80vh] w-full max-w-xl items-center justify-center">
        <section className="w-full rounded-2xl border border-slate-200 bg-white p-8 shadow-sm">
          <div className="mb-6">
            <h1 className="text-2xl font-semibold tracking-tight text-slate-900">
              RubriCheck Upload
            </h1>
            <p className="mt-2 text-sm text-slate-600">
              Upload your rubric and essay files to begin grading.
            </p>
          </div>

          <form className="space-y-5">
            <div>
              <label
                htmlFor="rubric"
                className="mb-2 block text-sm font-medium text-slate-700"
              >
                Rubric File
              </label>
              <input
                id="rubric"
                name="rubric"
                type="file"
                className="block w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-700 file:mr-4 file:rounded-md file:border-0 file:bg-slate-900 file:px-3 file:py-2 file:text-sm file:font-medium file:text-white hover:file:bg-slate-800"
              />
            </div>

            <div>
              <label
                htmlFor="essay"
                className="mb-2 block text-sm font-medium text-slate-700"
              >
                Essay File
              </label>
              <input
                id="essay"
                name="essay"
                type="file"
                className="block w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-700 file:mr-4 file:rounded-md file:border-0 file:bg-slate-900 file:px-3 file:py-2 file:text-sm file:font-medium file:text-white hover:file:bg-slate-800"
              />
            </div>

            <button
              type="submit"
              className="w-full rounded-lg bg-slate-900 px-4 py-2.5 text-sm font-medium text-white transition hover:bg-slate-800 focus:outline-none focus:ring-2 focus:ring-slate-400 focus:ring-offset-2"
            >
              Submit
            </button>
          </form>
        </section>
      </div>
    </main>
  );
}
