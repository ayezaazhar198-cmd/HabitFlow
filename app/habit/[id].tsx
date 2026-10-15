import { useLocalSearchParams } from 'expo-router';
import HabitFormScreen from '../../components/HabitFormScreen';

export default function EditHabitRoute() {
  const { id } = useLocalSearchParams<{ id: string }>();
  return <HabitFormScreen habitId={id} />;
}
