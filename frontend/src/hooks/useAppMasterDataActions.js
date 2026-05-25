import { PAGE_SIZE, isMockQuotationId, mergeSavedQuotation, removeMockQuotationId } from "../app/appUtils";
import { buildProductSavePayload } from "../app/productPayload";

function upsertEntity(currentRows, nextEntity) {
  return currentRows.some((row) => `${row.id}` === `${nextEntity.id}`)
    ? currentRows.map((row) => (`${row.id}` === `${nextEntity.id}` ? nextEntity : row))
    : [nextEntity, ...currentRows];
}

function removeEntity(currentRows, deletedId) {
  return currentRows.filter((row) => row.id !== deletedId);
}

export function useAppMasterDataActions({
  api,
  suppliers,
  setSuppliers,
  setSupplierRows,
  usingMockSuppliers,
  customers,
  setCustomers,
  setCustomerRows,
  usingMockCustomers,
  categories,
  setCategories,
  usingMockCategories,
  products,
  setProducts,
  setProductRows,
  usingMockProducts,
  quotations,
  setQuotations,
  usingMockQuotations,
  setNotice,
  setError,
  buildEntityNotice,
}) {
  async function handleSupplierSave(nextSupplier) {
    if (usingMockSuppliers) {
      const resolvedSupplier = nextSupplier;

      setSuppliers((currentRows) => upsertEntity(currentRows, resolvedSupplier));
      setSupplierRows((currentRows) =>
        upsertEntity(currentRows, resolvedSupplier).slice(0, PAGE_SIZE)
      );
      setNotice(
        buildEntityNotice(
          "app.messages.entitySaved",
          "supplier",
          resolvedSupplier.companyName || resolvedSupplier.id
        )
      );
      return resolvedSupplier;
    }

    try {
      const exists = suppliers.some((row) => `${row.id}` === `${nextSupplier.id}`);
      const savedSupplier = exists
        ? await api.updateSupplier(nextSupplier.id, nextSupplier)
        : await api.createSupplier(nextSupplier);
      const resolvedSupplier = savedSupplier || nextSupplier;

      setSuppliers((currentRows) => upsertEntity(currentRows, resolvedSupplier));
      setSupplierRows((currentRows) =>
        upsertEntity(currentRows, resolvedSupplier).slice(0, PAGE_SIZE)
      );
      setNotice(
        buildEntityNotice(
          "app.messages.entitySaved",
          "supplier",
          resolvedSupplier.companyName || resolvedSupplier.id
        )
      );
      return resolvedSupplier;
    } catch (requestError) {
      setError(requestError.message);
      return false;
    }
  }

  async function handleSupplierDelete(deletedSupplier) {
    if (usingMockSuppliers) {
      setSuppliers((currentRows) => removeEntity(currentRows, deletedSupplier.id));
      setSupplierRows((currentRows) => removeEntity(currentRows, deletedSupplier.id));
      setNotice(
        buildEntityNotice(
          "app.messages.entityDeleted",
          "supplier",
          deletedSupplier.companyName || deletedSupplier.id
        )
      );
      return true;
    }

    try {
      await api.deleteSupplier(deletedSupplier.id);
      setSuppliers((currentRows) => removeEntity(currentRows, deletedSupplier.id));
      setSupplierRows((currentRows) => removeEntity(currentRows, deletedSupplier.id));
      setNotice(
        buildEntityNotice(
          "app.messages.entityDeleted",
          "supplier",
          deletedSupplier.companyName || deletedSupplier.id
        )
      );
      return true;
    } catch (requestError) {
      setError(requestError.message);
      return false;
    }
  }

  async function handleCustomerSave(nextCustomer) {
    if (usingMockCustomers) {
      const resolvedCustomer = nextCustomer;

      setCustomers((currentRows) => upsertEntity(currentRows, resolvedCustomer));
      setCustomerRows((currentRows) =>
        upsertEntity(currentRows, resolvedCustomer).slice(0, PAGE_SIZE)
      );
      setNotice(
        buildEntityNotice(
          "app.messages.entitySaved",
          "customer",
          resolvedCustomer.companyName || resolvedCustomer.id
        )
      );
      return resolvedCustomer;
    }

    try {
      const exists = customers.some((row) => `${row.id}` === `${nextCustomer.id}`);
      const savedCustomer = exists
        ? await api.updateCustomer(nextCustomer.id, nextCustomer)
        : await api.createCustomer(nextCustomer);
      const resolvedCustomer = savedCustomer || nextCustomer;

      setCustomers((currentRows) => upsertEntity(currentRows, resolvedCustomer));
      setCustomerRows((currentRows) =>
        upsertEntity(currentRows, resolvedCustomer).slice(0, PAGE_SIZE)
      );
      setNotice(
        buildEntityNotice(
          "app.messages.entitySaved",
          "customer",
          resolvedCustomer.companyName || resolvedCustomer.id
        )
      );
      return resolvedCustomer;
    } catch (requestError) {
      setError(requestError.message);
      return false;
    }
  }

  async function handleCustomerDelete(deletedCustomer) {
    if (usingMockCustomers) {
      setCustomers((currentRows) => removeEntity(currentRows, deletedCustomer.id));
      setCustomerRows((currentRows) => removeEntity(currentRows, deletedCustomer.id));
      setNotice(
        buildEntityNotice(
          "app.messages.entityDeleted",
          "customer",
          deletedCustomer.companyName || deletedCustomer.id
        )
      );
      return true;
    }

    try {
      await api.deleteCustomer(deletedCustomer.id);
      setCustomers((currentRows) => removeEntity(currentRows, deletedCustomer.id));
      setCustomerRows((currentRows) => removeEntity(currentRows, deletedCustomer.id));
      setNotice(
        buildEntityNotice(
          "app.messages.entityDeleted",
          "customer",
          deletedCustomer.companyName || deletedCustomer.id
        )
      );
      return true;
    } catch (requestError) {
      setError(requestError.message);
      return false;
    }
  }

  async function handleCategorySave(nextCategory) {
    if (usingMockCategories) {
      const resolvedCategory = nextCategory;

      setCategories((currentRows) => upsertEntity(currentRows, resolvedCategory));
      setNotice(
        buildEntityNotice(
          "app.messages.entitySaved",
          "category",
          resolvedCategory.name || resolvedCategory.id
        )
      );
      return resolvedCategory;
    }

    try {
      const exists = categories.some((row) => `${row.id}` === `${nextCategory.id}`);
      const savedCategory = exists
        ? await api.updateCategory(nextCategory.id, nextCategory)
        : await api.createCategory(nextCategory);
      const resolvedCategory = savedCategory || nextCategory;

      setCategories((currentRows) => upsertEntity(currentRows, resolvedCategory));
      setNotice(
        buildEntityNotice(
          "app.messages.entitySaved",
          "category",
          resolvedCategory.name || resolvedCategory.id
        )
      );
      return resolvedCategory;
    } catch (requestError) {
      setError(requestError.message);
      return false;
    }
  }

  async function handleCategoryDelete(deletedCategory) {
    if (usingMockCategories) {
      setCategories((currentRows) => removeEntity(currentRows, deletedCategory.id));
      setNotice(
        buildEntityNotice(
          "app.messages.entityDeleted",
          "category",
          deletedCategory.name || deletedCategory.id
        )
      );
      return true;
    }

    try {
      await api.deleteCategory(deletedCategory.id);
      setCategories((currentRows) => removeEntity(currentRows, deletedCategory.id));
      setNotice(
        buildEntityNotice(
          "app.messages.entityDeleted",
          "category",
          deletedCategory.name || deletedCategory.id
        )
      );
      return true;
    } catch (requestError) {
      setError(requestError.message);
      return false;
    }
  }

  async function handleProductSave(nextProduct) {
    if (usingMockProducts) {
      const resolvedProduct = nextProduct;

      setProducts((currentRows) => upsertEntity(currentRows, resolvedProduct));
      setProductRows((currentRows) =>
        upsertEntity(currentRows, resolvedProduct).slice(0, PAGE_SIZE)
      );
      setNotice(
        buildEntityNotice(
          "app.messages.entitySaved",
          "product",
          resolvedProduct.productName || resolvedProduct.id
        )
      );
      return resolvedProduct;
    }

    try {
      const exists = products.some((row) => `${row.id}` === `${nextProduct.id}`);
      const productPayload = buildProductSavePayload(nextProduct);
      const savedProduct = exists
        ? await api.updateProduct(nextProduct.id, productPayload)
        : await api.createProduct(productPayload);
      const resolvedProduct = savedProduct || nextProduct;

      setProducts((currentRows) => upsertEntity(currentRows, resolvedProduct));
      setProductRows((currentRows) =>
        upsertEntity(currentRows, resolvedProduct).slice(0, PAGE_SIZE)
      );
      setNotice(
        buildEntityNotice(
          "app.messages.entitySaved",
          "product",
          resolvedProduct.productName || resolvedProduct.id
        )
      );
      return resolvedProduct;
    } catch (requestError) {
      setError(requestError.message);
      return false;
    }
  }

  async function handleProductDelete(deletedProduct) {
    if (usingMockProducts) {
      setProducts((currentRows) => removeEntity(currentRows, deletedProduct.id));
      setProductRows((currentRows) => removeEntity(currentRows, deletedProduct.id));
      setNotice(
        buildEntityNotice(
          "app.messages.entityDeleted",
          "product",
          deletedProduct.productName || deletedProduct.id
        )
      );
      return true;
    }

    try {
      await api.deleteProduct(deletedProduct.id);
      setProducts((currentRows) => removeEntity(currentRows, deletedProduct.id));
      setProductRows((currentRows) => removeEntity(currentRows, deletedProduct.id));
      setNotice(
        buildEntityNotice(
          "app.messages.entityDeleted",
          "product",
          deletedProduct.productName || deletedProduct.id
        )
      );
      return true;
    } catch (requestError) {
      setError(requestError.message);
      return false;
    }
  }

  async function handleQuotationSave(nextQuotation) {
    setError("");

    if (usingMockQuotations) {
      const resolvedQuotation = {
        ...nextQuotation,
        id: nextQuotation.id || `quotation-${Date.now()}`,
      };

      setQuotations((currentRows) => upsertEntity(currentRows, resolvedQuotation));
      setNotice(
        buildEntityNotice(
          "app.messages.entitySaved",
          "quotation",
          resolvedQuotation.reference_no || resolvedQuotation.id
        )
      );
      return resolvedQuotation;
    }

    try {
      const isMockQuotation = isMockQuotationId(nextQuotation.id);
      const exists =
        nextQuotation.id &&
        !isMockQuotation &&
        quotations.some((row) => `${row.id}` === `${nextQuotation.id}`);
      const savedQuotation = exists
        ? await api.updateQuotation(nextQuotation.id, nextQuotation)
        : await api.createQuotation(removeMockQuotationId(nextQuotation));
      const resolvedQuotation = savedQuotation || nextQuotation;

      setQuotations((currentRows) =>
        mergeSavedQuotation(currentRows, nextQuotation, resolvedQuotation, exists)
      );
      setNotice(
        buildEntityNotice(
          "app.messages.entitySaved",
          "quotation",
          resolvedQuotation.reference_no || resolvedQuotation.id
        )
      );
      return resolvedQuotation;
    } catch (requestError) {
      setError(requestError.message);
      return false;
    }
  }

  async function handleQuotationDelete(deletedQuotation) {
    setError("");

    if (usingMockQuotations || isMockQuotationId(deletedQuotation.id)) {
      setQuotations((currentRows) => removeEntity(currentRows, deletedQuotation.id));
      setNotice(
        buildEntityNotice(
          "app.messages.entityDeleted",
          "quotation",
          deletedQuotation.reference_no || deletedQuotation.id
        )
      );
      return true;
    }

    try {
      await api.deleteQuotation(deletedQuotation.id);
      setQuotations((currentRows) => removeEntity(currentRows, deletedQuotation.id));
      setNotice(
        buildEntityNotice(
          "app.messages.entityDeleted",
          "quotation",
          deletedQuotation.reference_no || deletedQuotation.id
        )
      );
      return true;
    } catch (requestError) {
      setError(requestError.message);
      return false;
    }
  }

  return {
    handleSupplierSave,
    handleSupplierDelete,
    handleCustomerSave,
    handleCustomerDelete,
    handleCategorySave,
    handleCategoryDelete,
    handleProductSave,
    handleProductDelete,
    handleQuotationSave,
    handleQuotationDelete,
  };
}
