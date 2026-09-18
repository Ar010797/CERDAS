const fs = require('fs');
let content = fs.readFileSync('src/screens/guru/Grades.tsx', 'utf8');

const oldHeader = `                      <div className="flex items-center justify-between mb-4 pb-3 border-b border-slate-50">
                        <h3 className="font-bold text-slate-800 text-lg flex items-center gap-2">
                           <div className="w-2 h-2 rounded-full bg-indigo-500" />
                           {subj}
                        </h3>
                        <button
                            onClick={() => handleAddTugas(subj)}
                           className="text-xs font-semibold text-indigo-600 bg-indigo-50 hover:bg-indigo-100 px-3 py-1.5 rounded-lg flex items-center gap-1 transition-colors"
                        >
                           <Plus className="w-3.5 h-3.5" />
                           Tambah Tugas
                        </button>
                      </div>`;

const newHeader = `                      <div className="flex items-center justify-between mb-4 pb-3 border-b border-slate-50">
                        <h3 className="font-bold text-slate-800 text-lg flex items-center gap-2">
                           <div className="w-2 h-2 rounded-full bg-indigo-500" />
                           {subj}
                        </h3>
                        <div className="flex items-center gap-2">
                          <button
                              onClick={() => handleAddTugas(subj)}
                             className="text-xs font-semibold text-indigo-600 bg-indigo-50 hover:bg-indigo-100 px-3 py-1.5 rounded-lg flex items-center gap-1 transition-colors"
                          >
                             <Plus className="w-3.5 h-3.5" />
                             Tambah Tugas
                          </button>
                          <button
                              onClick={() => handleAddUlanganHarian(subj)}
                             className="text-xs font-semibold text-emerald-600 bg-emerald-50 hover:bg-emerald-100 px-3 py-1.5 rounded-lg flex items-center gap-1 transition-colors"
                          >
                             <Plus className="w-3.5 h-3.5" />
                             Tambah UH
                          </button>
                        </div>
                      </div>`;

content = content.replace(oldHeader, newHeader);

const oldTugasGrid = `                        {/* Tugas Section */}
                        <div className="md:col-span-8 space-y-3">
                          <p className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-2">Nilai Tugas</p>
                          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                            {currentGrade.tugas.map((t, index) => (
                              <div key={index} className="relative group">
                                <label className="block text-xs font-medium text-slate-600 mb-1">Tugas {index + 1}</label>
                                <div className="flex items-center">
                                  <input
                                    type="number"
                                    min="0" max="100"
                                    value={t}
                                    onChange={(e) => handleTugasChange(subj, index, e.target.value)}
                                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none text-sm pr-8"
                                    placeholder="0-100"
                                  />
                                  {currentGrade.tugas.length > 1 && (
                                    <button
                                       onClick={() => handleRemoveTugas(subj, index)}
                                      className="absolute right-2 text-slate-400 hover:text-red-500 transition-colors p-1"
                                    >
                                      <Trash2 className="w-3.5 h-3.5" />
                                    </button>
                                  )}
                                </div>
                              </div>
                            ))}
                          </div>
                        </div>`;

const newTugasAndUHGrid = `                        {/* Tugas & UH Section */}
                        <div className="md:col-span-8 space-y-4">
                          <div className="space-y-3">
                            <p className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-2">Nilai Tugas</p>
                            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                              {currentGrade.tugas.map((t, index) => (
                                <div key={\`tugas-\${index}\`} className="relative group">
                                  <label className="block text-xs font-medium text-slate-600 mb-1">Tugas {index + 1}</label>
                                  <div className="flex items-center">
                                    <input
                                      type="number"
                                      min="0" max="100"
                                      value={t}
                                      onChange={(e) => handleTugasChange(subj, index, e.target.value)}
                                      className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none text-sm pr-8"
                                      placeholder="0-100"
                                    />
                                    {currentGrade.tugas.length > 1 && (
                                      <button
                                         onClick={() => handleRemoveTugas(subj, index)}
                                        className="absolute right-2 text-slate-400 hover:text-red-500 transition-colors p-1"
                                      >
                                        <Trash2 className="w-3.5 h-3.5" />
                                      </button>
                                    )}
                                  </div>
                                </div>
                              ))}
                            </div>
                          </div>

                          <div className="space-y-3 pt-2">
                            <p className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-2">Ulangan Harian</p>
                            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                              {(currentGrade.ulanganHarian || []).map((t, index) => (
                                <div key={\`uh-\${index}\`} className="relative group">
                                  <label className="block text-xs font-medium text-slate-600 mb-1">UH {index + 1}</label>
                                  <div className="flex items-center">
                                    <input
                                      type="number"
                                      min="0" max="100"
                                      value={t}
                                      onChange={(e) => handleUlanganHarianChange(subj, index, e.target.value)}
                                      className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg focus:ring-2 focus:ring-emerald-500 outline-none text-sm pr-8"
                                      placeholder="0-100"
                                    />
                                    {(currentGrade.ulanganHarian?.length > 1) && (
                                      <button
                                         onClick={() => handleRemoveUlanganHarian(subj, index)}
                                        className="absolute right-2 text-slate-400 hover:text-red-500 transition-colors p-1"
                                      >
                                        <Trash2 className="w-3.5 h-3.5" />
                                      </button>
                                    )}
                                  </div>
                                </div>
                              ))}
                            </div>
                          </div>
                        </div>`;

content = content.replace(oldTugasGrid, newTugasAndUHGrid);
fs.writeFileSync('src/screens/guru/Grades.tsx', content);
