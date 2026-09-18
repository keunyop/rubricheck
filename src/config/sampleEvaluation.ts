// Authored example. Opening it never calls the grading API or consumes a check.
export const SAMPLE_EVALUATION = {
  title: "Should schools start later?",
  essay: [
    "Secondary schools should start later in the morning because students need enough sleep to learn well. A later start could help students arrive more alert and ready to participate.",
    "In my class, several students say they struggle to concentrate during the first lesson. Moving the start time from 8:00 to 8:45 could give them more time to rest. Better attention could make discussions more useful and reduce the need to repeat instructions.",
    "Some families would find a later schedule difficult because of work and after-school activities. Schools could offer a supervised morning study room and adjust club schedules. Although a later start would require planning, the potential benefit to learning makes it worth trying."
  ],
  rubric: [
    { name: "Argument", max: 40, description: "State a clear position and develop a logical argument.", range: [28, 33], feedback: "The position is clear and consistent. Explain more precisely how a later start would improve learning." },
    { name: "Evidence", max: 40, description: "Use relevant, credible evidence and address a counterargument.", range: [25, 30], feedback: "The class example and scheduling objection are relevant. Add a credible source on sleep and explain how it supports the claim." },
    { name: "Organization", max: 20, description: "Organize ideas into connected paragraphs with a clear conclusion.", range: [17, 20], feedback: "The paragraphs progress from the claim to support and a counterargument. The conclusion clearly returns to the main position." }
  ],
  overallRange: "70–83",
  summary: "The essay presents a clear position, follows a logical structure, and acknowledges a practical objection. Its main weakness is the reliance on a classroom anecdote instead of credible evidence. Adding a source and explaining the connection between sleep and learning would strengthen the argument."
} as const;

