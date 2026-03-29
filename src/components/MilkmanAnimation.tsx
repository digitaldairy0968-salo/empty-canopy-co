import React from 'react';
import { motion } from 'framer-motion';

const MilkmanAnimation: React.FC = () => {
  return (
    <div className="relative w-40 h-48 mx-auto">
      {/* Upper Jar (Milk Source) */}
      <motion.div
        className="absolute top-0 left-1/2 -translate-x-1/2 w-16 h-12 bg-gradient-to-b from-gray-300 to-gray-400 rounded-t-lg border-2 border-gray-500"
        animate={{ 
          rotate: [0, -15, -15, 0],
        }}
        transition={{
          duration: 2,
          repeat: Infinity,
          repeatDelay: 0.5,
          times: [0, 0.2, 0.8, 1]
        }}
      >
        {/* Upper Jar Handle */}
        <div className="absolute -right-3 top-1 w-3 h-8 border-2 border-gray-500 rounded-r-full bg-gray-300" />
        {/* Milk inside upper jar */}
        <div className="absolute bottom-0 left-0.5 right-0.5 h-8 bg-white rounded-b-md overflow-hidden">
          <motion.div 
            className="absolute inset-0 bg-gradient-to-t from-blue-50 to-white"
            animate={{ height: ['100%', '30%', '30%', '100%'] }}
            transition={{
              duration: 2,
              repeat: Infinity,
              repeatDelay: 0.5,
              times: [0, 0.5, 0.8, 1]
            }}
          />
        </div>
      </motion.div>

      {/* Milk Stream */}
      <motion.div
        className="absolute top-12 left-1/2 -translate-x-1/2 w-3 bg-gradient-to-b from-white via-blue-50 to-white rounded-full"
        initial={{ height: 0, opacity: 0 }}
        animate={{ 
          height: [0, 60, 60, 0],
          opacity: [0, 1, 1, 0]
        }}
        transition={{
          duration: 2,
          repeat: Infinity,
          repeatDelay: 0.5,
          times: [0.1, 0.3, 0.7, 0.9]
        }}
      >
        {/* Milk droplets effect */}
        <motion.div
          className="absolute bottom-0 left-1/2 -translate-x-1/2 w-4 h-4 bg-white rounded-full blur-[1px]"
          animate={{ 
            scale: [1, 1.5, 1],
            opacity: [1, 0.5, 1]
          }}
          transition={{
            duration: 0.5,
            repeat: Infinity
          }}
        />
      </motion.div>

      {/* Lower Jar (Receiving Container) */}
      <div className="absolute bottom-0 left-1/2 -translate-x-1/2 w-20 h-20 bg-gradient-to-b from-gray-200 to-gray-300 rounded-b-2xl rounded-t-lg border-2 border-gray-400 overflow-hidden">
        {/* Lower Jar Handles */}
        <div className="absolute -left-2 top-2 w-2 h-12 bg-gray-300 rounded-l-full border-2 border-gray-400" />
        <div className="absolute -right-2 top-2 w-2 h-12 bg-gray-300 rounded-r-full border-2 border-gray-400" />
        
        {/* Milk filling up in lower jar */}
        <motion.div
          className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-white via-blue-50 to-white"
          initial={{ height: '10%' }}
          animate={{ 
            height: ['10%', '60%', '60%', '10%']
          }}
          transition={{
            duration: 2,
            repeat: Infinity,
            repeatDelay: 0.5,
            times: [0, 0.5, 0.8, 1]
          }}
        >
          {/* Milk surface wave effect */}
          <motion.div
            className="absolute top-0 left-0 right-0 h-2 bg-gradient-to-r from-transparent via-blue-100/50 to-transparent"
            animate={{ x: [-10, 10, -10] }}
            transition={{
              duration: 1,
              repeat: Infinity
            }}
          />
        </motion.div>
      </div>

      {/* Splash effect */}
      <motion.div
        className="absolute bottom-16 left-1/2 -translate-x-1/2"
        initial={{ opacity: 0, scale: 0 }}
        animate={{ 
          opacity: [0, 1, 0],
          scale: [0.5, 1.2, 0.5]
        }}
        transition={{
          duration: 0.5,
          repeat: Infinity,
          repeatDelay: 1.5,
          delay: 0.3
        }}
      >
        <div className="flex gap-1">
          <div className="w-1.5 h-1.5 bg-white rounded-full" />
          <div className="w-1 h-1 bg-blue-50 rounded-full" />
          <div className="w-1.5 h-1.5 bg-white rounded-full" />
        </div>
      </motion.div>
    </div>
  );
};

export default MilkmanAnimation;
