import data from '@/data/evals.json';
import { Evals, type EvalFile } from '@/ui/Evals';

export default function Page() {
  return <Evals data={data as unknown as EvalFile} />;
}
