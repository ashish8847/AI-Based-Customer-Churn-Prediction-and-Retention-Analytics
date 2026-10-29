import { useApi } from "../api.js";
import { GroupedBars, RateBars, ThresholdLines } from "../components/charts.jsx";
import { Card, ErrorNote, Kpi, Skeleton } from "../components/ui.jsx";

const pretty = { Accuracy: "accuracy", Precision: "precision", Recall: "recall", "F1": "f1", "ROC-AUC": "roc_auc" };

export default function Models() {
  const { data, error, reload } = useApi("/models");
  if (error) return <div className="page"><ErrorNote error={error} retry={reload} /></div>;
  if (!data) return <div className="page"><Skeleton h={120} /><Skeleton h={320} /></div>;
  const best = data.summary?.selected_model;
  const m = data.summary?.test_metrics;
  const names = (n) => n.replace("Logistic Regression", "Logistic Reg.").replace("Decision Tree", "Dec. Tree").replace("Random Forest", "Rand. Forest").replace("Gradient Boosting", "Grad. Boost");
  const metricData = data.comparison.map((r) => ({ model: names(r.model), precision: r.test_precision, recall: r.test_recall, f1: r.test_f1, auc: r.test_roc_auc }));
  const imbalance = data.comparison.map((r) => ({ model: names(r.model), without: data.imbalance.find((x) => x.model === r.model)?.test_recall, with: r.test_recall }));
  const imbAcc = data.comparison.map((r) => ({ model: names(r.model), without: data.imbalance.find((x) => x.model === r.model)?.test_accuracy, with: r.test_accuracy }));

  return (
    <div className="page">
      {m && (
        <div className="grid g-kpi">
          <Kpi accent i={0} label={`Selected: ${best}`} value={m.roc_auc} decimals={3} sub="test ROC-AUC" />
          <Kpi i={1} label="Recall" value={m.recall} decimals={3} sub="share of churners found" />
          <Kpi i={2} label="Precision" value={m.precision} decimals={3} sub="flagged who really churn" />
          <Kpi i={3} label="F1-score" value={m.f1} decimals={3} sub="balance of the two" />
          <Kpi i={4} label="Accuracy" value={m.accuracy} decimals={3} sub="can mislead (27% churn)" />
        </div>
      )}

      <Card i={1} title="Model comparison" subtitle={`Held-out test set (${data.summary?.test_rows?.toLocaleString("en-IN")} customers). ${best} was chosen by the highest 5-fold cross-validated F1 on training data. The models are very close.`}>
        <div className="tbl-wrap"><table>
          <thead><tr><th>Model</th><th className="r">CV F1</th><th className="r">Accuracy</th><th className="r">Precision</th><th className="r">Recall</th><th className="r">F1</th><th className="r">ROC-AUC</th></tr></thead>
          <tbody>{data.comparison.map((r) => (
            <tr key={r.model} style={r.selected === "True" || r.selected === true || r.model === best ? { background: "var(--med-bg)" } : undefined}>
              <td><b>{r.model}</b>{r.model === best && <span className="badge Medium" style={{ marginLeft: 8 }}>selected</span>}</td>
              <td className="r num">{r.cv_f1.toFixed(3)}</td><td className="r num">{r.test_accuracy.toFixed(3)}</td><td className="r num">{r.test_precision.toFixed(3)}</td><td className="r num">{r.test_recall.toFixed(3)}</td><td className="r num">{r.test_f1.toFixed(3)}</td><td className="r num">{r.test_roc_auc.toFixed(3)}</td></tr>))}
          </tbody>
        </table></div>
      </Card>

      <div className="grid g-charts">
        <Card i={2} title="Precision, recall, F1 and AUC"><GroupedBars data={metricData} xKey="model" keys={[{ key: "precision", name: "Precision" }, { key: "recall", name: "Recall" }, { key: "f1", name: "F1" }, { key: "auc", name: "ROC-AUC" }]} colors={["var(--chart-4)", "var(--chart-2)", "var(--chart-3)", "var(--chart-1)"]} domain={[0.4, 0.9]} /></Card>
        <Card i={3} title="Why not just accuracy?" subtitle="Balancing the classes trades some accuracy for far better recall">
          <GroupedBars data={imbalance} xKey="model" keys={[{ key: "without", name: "Recall without balancing" }, { key: "with", name: "Recall with balancing" }]} colors={["var(--chart-4)", "var(--chart-2)"]} domain={[0, 1]} />
        </Card>
        <Card i={4} title="Accuracy with and without balancing"><GroupedBars data={imbAcc} xKey="model" keys={[{ key: "without", name: "Without balancing" }, { key: "with", name: "With balancing" }]} colors={["var(--chart-4)", "var(--chart-1)"]} domain={[0.5, 1]} /></Card>
        <Card i={5} title="Decision threshold trade-off" subtitle="Cross-validated on training data: a lower threshold finds more churners but flags many more customers"><ThresholdLines data={data.thresholds} /></Card>
        <Card i={6} title="What the model relies on" subtitle="Permutation importance: drop in ROC-AUC when a feature is shuffled">
          <RateBars horizontal data={data.importance.map((d) => ({ ...d, importance: Number(d.importance.toFixed(4)) }))} xKey="feature" yKey="importance" unit="" name="AUC drop" height={320} />
        </Card>
        {data.figures.length > 0 && (
          <Card i={7} title="Evaluation plots">
            <div className="grid" style={{ gap: 16 }}>{data.figures.filter((f) => /roc|confusion/.test(f)).map((f) => <img key={f} src={f} alt={f.split("/").pop().replace(/[_\d]+/g, " ").replace(".png", "")} style={{ width: "100%", borderRadius: 12, background: "#fff" }} loading="lazy" />)}</div>
          </Card>
        )}
      </div>
      <Card i={8}><h3>Reading these results</h3><p className="small muted" style={{ marginTop: 6 }}>Recall is the share of churners the model finds; precision is the share of flagged customers who really leave. Missing a churner is costly, but low precision wastes retention offers. Differences between models here amount to a handful of customers out of {data.summary?.test_rows && Math.round(data.summary.test_rows * 0.2654)} churners in the test set, so the ranking is not conclusive.</p></Card>
    </div>
  );
}
