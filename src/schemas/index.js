/**
 * Schemas de Validação Zod - Meus Remédios
 *
 * Este módulo exporta todos os schemas de validação e helpers
 * para validação de dados da aplicação.
 */

// Schemas individuais
export {
  medicineSchema,
  medicineCreateSchema,
  medicineUpdateSchema,
  medicineFullSchema,
  validateMedicine,
  validateMedicineCreate,
  validateMedicineUpdate,
  mapMedicineErrorsToForm,
  getMedicineErrorMessage,
} from './medicineSchema'

export {
  protocolSchema,
  protocolCreateSchema,
  protocolUpdateSchema,
  protocolFullSchema,
  titrationStageSchema,
  validateProtocol,
  validateProtocolCreate,
  validateProtocolUpdate,
  validateTitrationStage,
  mapProtocolErrorsToForm,
  getProtocolErrorMessage,
} from './protocolSchema'

export {
  stockSchema,
  stockCreateSchema,
  stockUpdateSchema,
  stockFullSchema,
  stockDecreaseSchema,
  stockIncreaseSchema,
  validateStock,
  validateStockCreate,
  validateStockUpdate,
  validateStockDecrease,
  validateStockIncrease,
  mapStockErrorsToForm,
  getStockErrorMessage,
} from './stockSchema'

export {
  logSchema,
  logCreateSchema,
  logUpdateSchema,
  logFullSchema,
  logBulkCreateSchema,
  validateLog,
  validateLogCreate,
  validateLogUpdate,
  validateLogBulkCreate,
  validateLogBulkArray,
  mapLogErrorsToForm,
  mapBulkLogErrors,
  getLogErrorMessage,
  getBulkLogErrorMessage,
} from './logSchema'

// Helper geral de validação
export { validateEntity, ValidationError } from './validationHelper'
