import { apiRequest } from './api';

/**
 * testService.js (frontend) — UPDATED
 * createSourceAndTest() now accepts and sends a `scoring` object as part
 * of the POST /api/tests payload — the one place scoring rules actually
 * get persisted, at test-creation time. Everything else is unchanged.
 */

function normalizeSavedQuestion(q) {
  return {
    id: q._id,
    text: q.text,
    options: q.options,
    correctAnswer: q.correctAnswer,
    explanation: q.explanation,
  };
}

export async function createSourceAndTest({ method, rawContent, sourceUrl, questions, title, scoring }) {
  const { source } = await apiRequest('/sources', {
    method: 'POST',
    body: {
      sourceType: method === 'link' ? 'chatgpt_link' : 'text',
      sourceReference: sourceUrl || undefined,
      rawContent: rawContent || '(no original content available)',
    },
  });

  const { questions: savedQuestions } = await apiRequest('/questions/bulk', {
    method: 'POST',
    body: {
      sourceId: source._id,
      questions: questions.map(q => ({
        text: q.text,
        options: q.options,
        correctAnswer: q.correctAnswer,
        explanation: q.explanation,
        topic: q.topic || '',
      })),
    },
  });

  const { test } = await apiRequest('/tests', {
    method: 'POST',
    body: {
      title: title || 'Untitled Test',
      sourceId: source._id,
      questionIds: savedQuestions.map(q => q._id),
      scoring, // NEW — { marksPerCorrect, negativeMarksPerIncorrect, negativeMarkingRule }
    },
  });

  return {
    id: test._id,
    title: test.title,
    scoring: test.scoring,
    questions: test.questions.map(normalizeSavedQuestion),
  };
}
