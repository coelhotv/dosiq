import React from 'react'
import { motion } from 'framer-motion'
import StockCardRedesign from '@stock/components/redesign/StockCardRedesign'

export default function StockInventoryGrid({ 
  items, 
  onAddStock, 
  motionConfig 
}) {
  return (
    <>
      <div className="stock-redesign__section-header">
        <h2 className="stock-redesign__section-title">Inventário Ativo ({items.length})</h2>
      </div>
      <motion.div
        className="stock-redesign__grid stock-redesign__grid--complex"
        variants={motionConfig.cascade.container}
        initial="hidden"
        animate="visible"
      >
        {items.map((item, index) => (
          <StockCardRedesign
            key={item.medicine.id}
            item={item}
            isComplex={true}
            onAddStock={() => onAddStock(item.medicine.id)}
            index={index}
          />
        ))}
      </motion.div>
    </>
  )
}
