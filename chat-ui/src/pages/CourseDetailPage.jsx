import { useState, useMemo, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { fetchCourseIntro, fetchCourseContent, fetchCourseActivities, fetchCourseQuiz, submitCourseQuiz } from '../api';
import ThemeToggle from '../components/ThemeToggle';
import './CourseDetailPage.css';

// ─────────────────────────────────────────────────────────────────────────
// Tab Definitions
// ─────────────────────────────────────────────────────────────────────────
const TABS = [
  { id: 'intro', label: 'المقدمة', icon: '📖' },
  { id: 'content', label: 'المحتوى', icon: '📝' },
  { id: 'activities', label: 'الأنشطة', icon: '🎯' },
  { id: 'quiz', label: 'الاختبار', icon: '✅' },
];

/**
 * ─────────────────────────────────────────────────────────────────────────
 * Shared Utilities
 * ─────────────────────────────────────────────────────────────────────────
 */
function ErrorDisplay({ error, onRetry }) {
  return (
    <div className="error-state">
      <h3>⚠️ عذراً، أواجه مشكلة في تحميل هذه البيانات</h3>
      <p>{error.message}</p>
      {onRetry && (
        <button className="retry-btn" onClick={onRetry}>
          إعادة المحاولة
        </button>
      )}
    </div>
  );
}

function Loader() {
  return (
    <div className="loader-container">
      <div className="spinner"></div>
      <p>جاري التحميل...</p>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────
// Introduction Tab
// ─────────────────────────────────────────────────────────────────────────
function IntroTab({ courseId }) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const loadData = async () => {
    setLoading(true); setError(null);
    try {
      const result = await fetchCourseIntro(courseId);
      setData(result);
    } catch (err) {
      setError(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { loadData(); }, [courseId]);

  if (loading) return <Loader />;
  if (error) return <ErrorDisplay error={error} onRetry={loadData} />;
  if (!data) return null;

  return (
    <div className="tab-content intro-tab glass-panel">
      <h2>{data.title}</h2>
      <div className="intro-text">
        {data.content.split('\n\n').map((para, i) => (
          <p key={i}>{para}</p>
        ))}
      </div>
      <div className="key-points">
        <h3>🔑 النقاط الرئيسية</h3>
        <ul>
          {data.keyPoints.map((point, i) => (
            <li key={i}>
              <span className="point-bullet" />
              {point}
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────
// Content Tab
// ─────────────────────────────────────────────────────────────────────────
function ContentTab({ courseId }) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const loadData = async () => {
    setLoading(true); setError(null);
    try {
      const result = await fetchCourseContent(courseId);
      setData(result);
    } catch (err) {
      setError(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { loadData(); }, [courseId]);

  if (loading) return <Loader />;
  if (error) return <ErrorDisplay error={error} onRetry={loadData} />;
  if (!data) return null;

  return (
    <div className="tab-content content-tab glass-panel">
      <h2>{data.title}</h2>
      {data.sections.map((section, i) => (
        <div key={i} className="content-section">
          <h3>{section.heading}</h3>
          <div className="section-text">
            {section.text.split('\n\n').map((para, j) => (
              <p key={j} dangerouslySetInnerHTML={{
                __html: para
                  .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
                  .replace(/\n/g, '<br/>')
              }} />
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────
// Activities Tab Components
// ─────────────────────────────────────────────────────────────────────────
function MatchingActivity({ activity }) {
  const [selected, setSelected] = useState({});
  const [termSelected, setTermSelected] = useState(null);
  const [results, setResults] = useState({});

  const definitions = useMemo(() => {
    return [...activity.pairs.map(p => p.definition)].sort(() => Math.random() - 0.5);
  }, [activity.pairs]);

  const handleTermClick = (index) => {
    if (results[index] === true) return;
    setTermSelected(index);
  };

  const handleDefClick = (def) => {
    if (termSelected === null) return;
    const correct = activity.pairs[termSelected].definition === def;
    setResults(prev => ({ ...prev, [termSelected]: correct }));
    setSelected(prev => ({ ...prev, [termSelected]: def }));
    setTermSelected(null);
  };

  const usedDefs = Object.values(selected);

  return (
    <div className="activity-block">
      <p className="activity-instruction">{activity.instruction}</p>
      <div className="matching-grid">
        <div className="matching-column">
          <h4>المصطلحات</h4>
          {activity.pairs.map((pair, i) => (
            <button
              key={i}
              className={`match-item term ${termSelected === i ? 'selected' : ''} ${results[i] === true ? 'correct' : results[i] === false ? 'wrong' : ''}`}
              onClick={() => handleTermClick(i)}
              disabled={results[i] === true}
            >
              {pair.term}
            </button>
          ))}
        </div>
        <div className="matching-column">
          <h4>التعريفات</h4>
          {definitions.map((def, i) => (
            <button
              key={i}
              className={`match-item def ${usedDefs.includes(def) ? 'used' : ''}`}
              onClick={() => handleDefClick(def)}
              disabled={usedDefs.includes(def)}
            >
              {def}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}

function OrderingActivity({ activity }) {
  const [items, setItems] = useState(() =>
    [...activity.correctOrder].sort(() => Math.random() - 0.5)
  );
  const [checked, setChecked] = useState(false);
  const [dragIndex, setDragIndex] = useState(null);

  const handleDragStart = (index) => {
    setDragIndex(index);
  };

  const handleDrop = (dropIndex) => {
    if (dragIndex === null || dragIndex === dropIndex) return;
    const newItems = [...items];
    const [dragged] = newItems.splice(dragIndex, 1);
    newItems.splice(dropIndex, 0, dragged);
    setItems(newItems);
    setDragIndex(null);
    setChecked(false);
  };

  const moveItem = (index, direction) => {
    const newIndex = index + direction;
    if (newIndex < 0 || newIndex >= items.length) return;
    const newItems = [...items];
    [newItems[index], newItems[newIndex]] = [newItems[newIndex], newItems[index]];
    setItems(newItems);
    setChecked(false);
  };

  const isCorrect = (index) => items[index] === activity.correctOrder[index];

  return (
    <div className="activity-block">
      <p className="activity-instruction">{activity.instruction}</p>
      <div className="ordering-list">
        {items.map((item, i) => (
          <div
            key={item}
            className={`order-item ${checked ? (isCorrect(i) ? 'correct' : 'wrong') : ''} ${dragIndex === i ? 'dragging' : ''}`}
            draggable
            onDragStart={() => handleDragStart(i)}
            onDragOver={(e) => e.preventDefault()}
            onDrop={() => handleDrop(i)}
          >
            <span className="order-num">{i + 1}</span>
            <span className="order-text">{item}</span>
            <div className="order-controls">
              <button className="order-btn" onClick={() => moveItem(i, -1)} disabled={i === 0}>▲</button>
              <button className="order-btn" onClick={() => moveItem(i, 1)} disabled={i === items.length - 1}>▼</button>
            </div>
          </div>
        ))}
      </div>
      <button className="check-btn" onClick={() => setChecked(true)}>
        تحقق من الترتيب
      </button>
      {checked && (
        <div className={`order-result ${items.every((item, i) => item === activity.correctOrder[i]) ? 'all-correct' : ''}`}>
          {items.every((item, i) => item === activity.correctOrder[i])
            ? '🎉 ممتاز! الترتيب صحيح بالكامل'
            : '⚠️ بعض العناصر ليست في مكانها الصحيح، حاول مرة أخرى'}
        </div>
      )}
    </div>
  );
}

function ActivitiesTab({ courseId }) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const loadData = async () => {
    setLoading(true); setError(null);
    try {
      const result = await fetchCourseActivities(courseId);
      setData(result);
    } catch (err) {
      setError(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { loadData(); }, [courseId]);

  if (loading) return <Loader />;
  if (error) return <ErrorDisplay error={error} onRetry={loadData} />;
  if (!data) return null;

  return (
    <div className="tab-content activities-tab glass-panel">
      <h2>{data.title}</h2>
      {data.items.map((activity, i) => (
        <div key={i} className="activity-wrapper">
          {activity.type === 'matching' && <MatchingActivity activity={activity} />}
          {activity.type === 'ordering' && <OrderingActivity activity={activity} />}
        </div>
      ))}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────
// Quiz Tab
// ─────────────────────────────────────────────────────────────────────────
function QuizTab({ courseId }) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const [answers, setAnswers] = useState({});
  const [scoreResult, setScoreResult] = useState(null);
  const [submitting, setSubmitting] = useState(false);

  const loadData = async () => {
    setLoading(true); setError(null); setScoreResult(null); setAnswers({});
    try {
      const result = await fetchCourseQuiz(courseId);
      setData(result);
    } catch (err) {
      setError(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { loadData(); }, [courseId]);

  const handleSelect = (qId, optIndex) => {
    if (scoreResult) return;
    setAnswers(prev => ({ ...prev, [qId]: optIndex }));
  };

  const submitQuizAnswers = async () => {
    setSubmitting(true);
    try {
      const res = await submitCourseQuiz(courseId, answers);
      setScoreResult(res);
    } catch (err) {
      setError(err);
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) return <Loader />;
  if (error && !data) return <ErrorDisplay error={error} onRetry={loadData} />;
  if (!data) return null;

  return (
    <div className="tab-content quiz-tab glass-panel">
      <h2>{data.title}</h2>

      {error && <ErrorDisplay error={error} />}

      {scoreResult && (
        <div className={`quiz-result ${scoreResult.percentage >= 80 ? 'excellent' : scoreResult.percentage >= 60 ? 'good' : 'needs-work'}`}>
          <div className="result-score">
            <span className="result-number">{scoreResult.score}/{scoreResult.total}</span>
            <span className="result-percent">{scoreResult.percentage}%</span>
          </div>
          <p className="result-message">
            {scoreResult.percentage >= 80 ? '🎉 ممتاز! أداء رائع' : scoreResult.percentage >= 60 ? '👍 جيد، يمكنك التحسن أكثر' : '📚 تحتاج لمراجعة المحتوى مرة أخرى'}
          </p>
        </div>
      )}

      <div className="questions-list">
        {data.questions.map((q, qi) => {
          let questionClasses = 'question-card';
          let qResult = scoreResult?.results.find(r => r.id === q.id);
          if (scoreResult && qResult) {
            questionClasses += qResult.is_correct ? ' correct' : ' wrong';
          }
          return (
            <div key={qi} className={questionClasses}>
              <div className="question-header">
                <span className="question-num">سؤال {qi + 1}</span>
                {qResult && (
                  <span className={`question-badge ${qResult.is_correct ? 'badge-correct' : 'badge-wrong'}`}>
                    {qResult.is_correct ? '✓ صحيح' : '✗ خطأ'}
                  </span>
                )}
              </div>
              <p className="question-text">{q.question}</p>
              <div className="options-list">
                {q.options.map((opt, oi) => {
                  let optClasses = 'option-btn';
                  if (answers[q.id] === oi) optClasses += ' selected';
                  if (qResult) {
                      if (oi === qResult.correct_option) optClasses += ' correct-answer';
                      else if (answers[q.id] === oi && oi !== qResult.correct_option) optClasses += ' wrong-answer';
                  }
                  return (
                    <button
                      key={oi}
                      className={optClasses}
                      onClick={() => handleSelect(q.id, oi)}
                      disabled={scoreResult != null || submitting}
                    >
                      <span className="option-letter"></span>
                      <span className="option-text">{opt}</span>
                    </button>
                  );
                })}
              </div>
              {qResult && qResult.explanation && (
                <div className="explanation">
                  <span className="explanation-icon">💡</span>
                  <span>{qResult.explanation}</span>
                </div>
              )}
            </div>
          );
        })}
      </div>

      {!scoreResult ? (
        <button
          className="submit-quiz-btn"
          onClick={submitQuizAnswers}
          disabled={Object.keys(answers).length < data.questions.length || submitting}
        >
          {submitting ? 'جاري التقييم...' : Object.keys(answers).length < data.questions.length
            ? `أجب على جميع الأسئلة (${Object.keys(answers).length}/${data.questions.length})`
            : 'تقديم الاختبار'}
        </button>
      ) : (
        <button className="submit-quiz-btn retry" onClick={loadData}>
          إعادة الاختبار بأسئلة مختلفة
        </button>
      )}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────
// Main Component
// ─────────────────────────────────────────────────────────────────────────
export default function CourseDetailPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState('intro');

  // Load basic course metadata for styling/header purposes.
  // In a real app we might fetch just the single course info, but here we just reuse fetchCourses
  const [courseMeta, setCourseMeta] = useState(null);

  useEffect(() => {
     // Ideally you'd have simple endpoint, mapping from list for now
     import('../api').then(m => m.fetchCourses()).then(data => {
         const specific = data.find(c => c.id === id);
         setCourseMeta(specific);
     }).catch(e => console.error("Could not fetch course metadata", e));
  }, [id]);

  if (!courseMeta && !activeTab) return <Loader />;

  return (
    <div className="course-detail">
      {/* Background */}
      {courseMeta && (
        <div className="detail-bg">
          <div className="detail-gradient" style={{ '--accent': courseMeta.color }} />
        </div>
      )}

      <nav className="detail-nav">
        <button className="nav-back" onClick={() => navigate('/courses')}>
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <polyline points="9 18 15 12 9 6" />
          </svg>
          <span>العودة للدورات</span>
        </button>
        <ThemeToggle />
      </nav>

      {/* Course Header */}
      {courseMeta && (
        <header className="detail-header glass-panel">
          <h1>{courseMeta.title}</h1>
          <p>{courseMeta.description}</p>
        </header>
      )}

      {/* Tabs */}
      <div className="tabs-container">
        <div className="tabs-bar">
          {TABS.map(tab => (
            <button
              key={tab.id}
              className={`tab-btn ${activeTab === tab.id ? 'active' : ''}`}
              onClick={() => setActiveTab(tab.id)}
              style={{ '--accent': courseMeta ? courseMeta.color : '#3498db' }}
            >
              <span className="tab-label">{tab.label}</span>
            </button>
          ))}
        </div>
      </div>

      {/* Tab Content */}
      <div className="tab-panel" key={activeTab}>
        {activeTab === 'intro' && <IntroTab courseId={id} />}
        {activeTab === 'content' && <ContentTab courseId={id} />}
        {activeTab === 'activities' && <ActivitiesTab courseId={id} />}
        {activeTab === 'quiz' && <QuizTab courseId={id} />}
      </div>
    </div>
  );
}
