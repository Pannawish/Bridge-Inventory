export function markFieldBlurredOnBlurCapture(event) {
  const target = event?.target;

  if (!(target instanceof HTMLElement)) {
    return;
  }

  if (target.matches("input, select, textarea")) {
    target.dataset.blurred = "true";
  }
}
