import type { ItemScore } from "./psychometrics";

export interface TopicMetric {
  topic: string;
  earnedPoints: number;
  maxPoints: number;
  percentage: number;
  itemCount: number;
  lowConfidence: boolean; // true if < 3 items
  studentsBelowHalf?: number; // cohort: number of students with < 50% on this topic
}

export interface BuildTopicBreakdownInput {
  items: ItemScore[];
  totals: number[];
  topicByQuestionId: Map<string, string | null | undefined>;
  flaggedQuestionIds?: Set<string>;
}

export interface StudentTopicPerformanceInput {
  questions: {
    questionId: string;
    points: number;
    topic: string | null | undefined;
  }[];
  submissions: {
    questionId: string;
    pointsAwarded: number | null;
  }[];
}

/**
 * Builds topic mastery breakdown across an entire cohort for the analytics dashboard.
 * Preserves untagged questions in an explicit "Untagged" bucket.
 * Sorts weakest topics first.
 */
export function buildCohortTopicBreakdown(
  input: BuildTopicBreakdownInput,
): TopicMetric[] {
  const { items, totals, topicByQuestionId } = input;
  const n = totals.length;

  const topicMap = new Map<
    string,
    {
      earnedPoints: number;
      maxPoints: number;
      itemCount: number;
      studentScores: number[]; // points per student
      studentMax: number;
    }
  >();

  // Initialize topics
  for (const item of items) {
    const rawTopic = topicByQuestionId.get(item.questionId);
    const topic = rawTopic?.trim() ? rawTopic.trim() : "Untagged";

    if (!topicMap.has(topic)) {
      topicMap.set(topic, {
        earnedPoints: 0,
        maxPoints: 0,
        itemCount: 0,
        studentScores: new Array(n).fill(0),
        studentMax: 0,
      });
    }

    const group = topicMap.get(topic)!;
    group.itemCount += 1;
    group.studentMax += item.maxPoints;

    for (let sIdx = 0; sIdx < n; sIdx++) {
      const pts = item.scores[sIdx] ?? 0;
      group.earnedPoints += pts;
      group.studentScores[sIdx] += pts;
    }
    group.maxPoints += item.maxPoints * n;
  }

  const results: TopicMetric[] = [];

  for (const [topic, data] of topicMap.entries()) {
    const percentage =
      data.maxPoints > 0 ? (data.earnedPoints / data.maxPoints) * 100 : 0;

    let studentsBelowHalf = 0;
    if (data.studentMax > 0) {
      for (const score of data.studentScores) {
        if (score / data.studentMax < 0.5) {
          studentsBelowHalf++;
        }
      }
    }

    results.push({
      topic,
      earnedPoints: Math.round(data.earnedPoints * 10) / 10,
      maxPoints: Math.round(data.maxPoints * 10) / 10,
      percentage: Math.round(percentage * 10) / 10,
      itemCount: data.itemCount,
      lowConfidence: data.itemCount < 3,
      studentsBelowHalf,
    });
  }

  // Sort weakest topic first
  results.sort((a, b) => a.percentage - b.percentage);
  return results;
}

/**
 * Builds individual student topic mastery for the student result page and focus area chip.
 * Weakest topics sorted first.
 */
export function buildStudentTopicBreakdown(
  input: StudentTopicPerformanceInput,
): TopicMetric[] {
  const { questions, submissions } = input;
  const submissionsMap = new Map(
    submissions.map((s) => [s.questionId, s.pointsAwarded ?? 0]),
  );

  const topicMap = new Map<
    string,
    {
      earnedPoints: number;
      maxPoints: number;
      itemCount: number;
    }
  >();

  for (const q of questions) {
    const topic = q.topic?.trim() ? q.topic.trim() : "Untagged";
    if (!topicMap.has(topic)) {
      topicMap.set(topic, { earnedPoints: 0, maxPoints: 0, itemCount: 0 });
    }
    const group = topicMap.get(topic)!;
    group.itemCount += 1;
    group.maxPoints += q.points;
    group.earnedPoints += submissionsMap.get(q.questionId) ?? 0;
  }

  const results: TopicMetric[] = [];
  for (const [topic, data] of topicMap.entries()) {
    const percentage =
      data.maxPoints > 0 ? (data.earnedPoints / data.maxPoints) * 100 : 0;
    results.push({
      topic,
      earnedPoints: Math.round(data.earnedPoints * 10) / 10,
      maxPoints: Math.round(data.maxPoints * 10) / 10,
      percentage: Math.round(percentage * 10) / 10,
      itemCount: data.itemCount,
      lowConfidence: data.itemCount < 3,
    });
  }

  // Sort weakest topics first
  results.sort((a, b) => a.percentage - b.percentage);
  return results;
}
