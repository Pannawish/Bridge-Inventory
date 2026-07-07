// React component for quotation workflow: quotation purchase wizard flow.

import MultiPurchaseWizard from "../MultiPurchaseWizard";

function QuotationPurchaseWizardFlow({
  conversion,
  products = [],
  suppliers = [],
  purchases = [],
  onCreatePurchase,
  onCancel,
  onViewPurchases,
}) {
  if (!conversion || conversion.step !== "purchase-wizard") {
    return null;
  }

  return (
    <MultiPurchaseWizard
      key={`purchase-wizard-${conversion.quotation.id}`}
      groups={conversion.groups}
      products={products}
      suppliers={suppliers}
      purchases={purchases}
      onCreatePurchase={onCreatePurchase}
      onCancel={onCancel}
      onViewPurchases={onViewPurchases}
    />
  );
}

export default QuotationPurchaseWizardFlow;
