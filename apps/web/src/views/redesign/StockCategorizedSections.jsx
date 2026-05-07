import React from 'react'
import { motion } from 'framer-motion'
import StockCardRedesign from '@stock/components/redesign/StockCardRedesign'

export default function StockCategorizedSections({ 
  criticalItems, 
  warningItems, 
  okItems, 
  orphanItems, 
  onAddStock, 
  motionConfig 
}) {
  return (
    <motion.div
      className="stock-redesign__sections"
      variants={motionConfig.cascade.container}
      initial="hidden"
      animate="visible"
    >
      {criticalItems.length > 0 && (
        <>
          <h2 className="stock-redesign__section-label stock-redesign__section-label--urgente">
            Crítico ({criticalItems.length})
          </h2>
          <motion.div variants={motionConfig.cascade.item} className="stock-redesign__section">
            {criticalItems.map((item, index) => (
              <StockCardRedesign
                key={item.medicine.id}
                item={item}
                isComplex={false}
                onAddStock={() => onAddStock(item.medicine.id)}
                index={index}
              />
            ))}
          </motion.div>
        </>
      )}

      {warningItems.length > 0 && (
        <>
          <h2 className="stock-redesign__section-label stock-redesign__section-label--atencao">
            Atenção ({warningItems.length})
          </h2>
          <motion.div variants={motionConfig.cascade.item} className="stock-redesign__section">
            {warningItems.map((item, index) => (
              <StockCardRedesign
                key={item.medicine.id}
                item={item}
                isComplex={false}
                onAddStock={() => onAddStock(item.medicine.id)}
                index={index}
              />
            ))}
          </motion.div>
        </>
      )}

      {okItems.length > 0 && (
        <>
          <h2 className="stock-redesign__section-label stock-redesign__section-label--seguro">
            Estoque OK ({okItems.length})
          </h2>
          <motion.div variants={motionConfig.cascade.item} className="stock-redesign__section">
            {okItems.map((item, index) => (
              <StockCardRedesign
                key={item.medicine.id}
                item={item}
                isComplex={false}
                onAddStock={() => onAddStock(item.medicine.id)}
                index={index}
              />
            ))}
          </motion.div>
        </>
      )}

      {orphanItems.length > 0 && (
        <>
          <h2 className="stock-redesign__section-label stock-redesign__section-label--seguro">
            Sem Tratamento Ativo ({orphanItems.length})
          </h2>
          <motion.div variants={motionConfig.cascade.item} className="stock-redesign__section">
            {orphanItems.map((item, index) => (
              <StockCardRedesign
                key={item.medicine.id}
                item={item}
                isComplex={false}
                onAddStock={() => onAddStock(item.medicine.id)}
                index={index}
              />
            ))}
          </motion.div>
        </>
      )}
    </motion.div>
  )
}
