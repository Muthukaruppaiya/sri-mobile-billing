import { motion } from 'framer-motion'
import { useNavigate } from 'react-router-dom'
import { LayoutDashboard, Package, Receipt, Smartphone, Wrench } from 'lucide-react'
import { todayDeliveryCount } from '../data/mock'
import { AmbientBackground } from '../components/ui'

export function SplashPage() {
  const navigate = useNavigate()

  return (
    <>
      <AmbientBackground />
      <div className="splash">
        <motion.div
          initial={{ opacity: 0, scale: 0.86 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.55, ease: [0.22, 1, 0.36, 1] }}
        >
          <motion.div
            className="phone-mock"
            animate={{ y: [0, -10, 0], rotate: [0, -2, 2, 0] }}
            transition={{ duration: 4.5, repeat: Infinity, ease: 'easeInOut' }}
          >
            <div className="phone-mock__screen">
              <div className="phone-mock__scan" />
            </div>
          </motion.div>

          <motion.h1
            className="splash__brand"
            initial={{ opacity: 0, y: 24 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2, duration: 0.45 }}
          >
            SRI
            <br />
            MOBILES
          </motion.h1>

          <motion.p
            className="splash__tag"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.35 }}
          >
            Billing · Stock · Service desk
          </motion.p>

          <motion.div
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.45 }}
            style={{ display: 'flex', flexDirection: 'column', gap: 10, maxWidth: 320, margin: '0 auto' }}
          >
            <button className="btn btn--primary btn--block" onClick={() => navigate('/app')}>
              <LayoutDashboard size={18} /> Home
            </button>
            <div className="splash-links">
              <button className="btn btn--ghost" onClick={() => navigate('/app/billing')}>
                <Receipt size={16} /> Sale
              </button>
              <button className="btn btn--ghost" onClick={() => navigate('/app/service')}>
                <Wrench size={16} /> Service
              </button>
              <button className="btn btn--ghost" onClick={() => navigate('/app/stock')}>
                <Package size={16} /> Stock
              </button>
              <button className="btn btn--accent" onClick={() => navigate('/app/service')}>
                <Smartphone size={16} /> {todayDeliveryCount}
              </button>
            </div>
          </motion.div>
        </motion.div>
      </div>
    </>
  )
}
