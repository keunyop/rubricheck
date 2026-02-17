import assert from "node:assert/strict";

function appendParagraph(baseText, paragraph) {
  const normalizedParagraph = paragraph.trim();
  if (!normalizedParagraph) {
    return baseText;
  }

  const base = baseText.trimEnd();
  if (!base) {
    return normalizedParagraph;
  }

  return `${base}\n\n${normalizedParagraph}`;
}

function applyPatchToAssignment(assignmentText, patch) {
  if (patch.type === "append_paragraph") {
    return {
      patchedText: appendParagraph(assignmentText, patch.newText),
      appendedFallback: false,
    };
  }

  const exactIndex = assignmentText.indexOf(patch.originalExcerpt);
  if (exactIndex !== -1) {
    const before = assignmentText.slice(0, exactIndex);
    const after = assignmentText.slice(exactIndex + patch.originalExcerpt.length);
    return {
      patchedText: `${before}${patch.newText}${after}`,
      appendedFallback: false,
    };
  }

  return {
    patchedText: appendParagraph(assignmentText, patch.newText),
    appendedFallback: true,
  };
}

function capAfterRange({ beforeRange, afterRange, criterionMaxScore, totalRubricMaxScore }) {
  const criteriaDeltaCap = Math.max(0, Math.floor(criterionMaxScore * 0.2));
  const overallDeltaCapRaw = Math.max(0, Math.floor((12 / 100) * totalRubricMaxScore));
  const allowedPositiveIncrease = Math.min(criteriaDeltaCap, overallDeltaCapRaw);

  let low = afterRange[0];
  let high = afterRange[1];

  if (low > beforeRange[0] + allowedPositiveIncrease) {
    low = beforeRange[0] + allowedPositiveIncrease;
  }

  if (high > beforeRange[1] + allowedPositiveIncrease) {
    high = beforeRange[1] + allowedPositiveIncrease;
  }

  return [low, high];
}

function runHarness() {
  const replace = applyPatchToAssignment("A\n\nB", {
    type: "replace_paragraph",
    originalExcerpt: "B",
    newText: "B improved",
  });
  assert.equal(replace.appendedFallback, false);
  assert.equal(replace.patchedText.includes("B improved"), true);

  const fallback = applyPatchToAssignment("Paragraph one.", {
    type: "replace_paragraph",
    originalExcerpt: "Not in text",
    newText: "New paragraph",
  });
  assert.equal(fallback.appendedFallback, true);
  assert.equal(fallback.patchedText.endsWith("New paragraph"), true);

  const capped = capAfterRange({
    beforeRange: [6, 7],
    afterRange: [10, 10],
    criterionMaxScore: 10,
    totalRubricMaxScore: 40,
  });
  assert.deepEqual(capped, [8, 9]);

  console.log("simulate_harness: all checks passed");
}

runHarness();
