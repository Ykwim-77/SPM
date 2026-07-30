const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
(async () => {
  try {
    const dmmf = prisma._dmmf || prisma.dmmf || null;
    if (dmmf) {
      const model = dmmf.datamodel ? dmmf.datamodel.models.find(m => m.name === 'Patient') : (dmmf.modelMap && dmmf.modelMap.Patient ? dmmf.modelMap.Patient : null);
      console.log('DMMF model fields:', model ? model.fields.map(f => f.name) : Object.keys(dmmf));
    } else {
      console.log('No DMMF available.');
    }
  } catch (e) {
    console.error(e);
  } finally {
    await prisma.$disconnect();
  }
})();
