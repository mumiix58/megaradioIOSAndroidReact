import { useEffect, useRef } from 'react';
import { rateUsService } from '../services/rateUsService';

interface Props {
  visible: boolean;
  onClose: () => void;
}

/** Native stores own the review UI; never show a custom opinion pre-prompt. */
export function RateUsModal({ visible, onClose }: Props) {
  const requesting = useRef(false);
  const onCloseRef = useRef(onClose);
  onCloseRef.current = onClose;

  useEffect(() => {
    if (!visible || requesting.current) return;
    requesting.current = true;
    void rateUsService.requestReviewIfEligible().finally(() => {
      requesting.current = false;
      onCloseRef.current();
    });
  }, [visible]);

  return null;
}

export default RateUsModal;
