import { usePredictions } from '@/hooks/usePredictions';
import { PredictionsView } from './PredictionsView';

export default function PredictionsPage() {
    const props = usePredictions();
    return <PredictionsView {...props} />;
}
