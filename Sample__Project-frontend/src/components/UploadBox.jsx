import React from 'react';

const UploadBox = ({ onFileSelect, acceptType, label }) => {
    return (
        <div className="border-2 border-dashed border-gray-400 p-6 rounded-lg text-center cursor-pointer hover:bg-gray-50">
            <label className="cursor-pointer">
                <span className="block text-gray-600 mb-2">{label}</span>
                <input 
                    type="file" 
                    className="hidden" 
                    accept={acceptType} 
                    onChange={(e) => onFileSelect(e.target.files[0])}
                />
                <span className="bg-blue-500 text-white px-4 py-2 rounded">Dosya Seç</span>
            </label>
        </div>
    );
};

export default UploadBox;