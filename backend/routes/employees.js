const express = require('express');
const router = express.Router();
const employeeController = require('../controllers/employeeController');
const { authenticateToken, injectMerchantId, injectRlsContext } = require('../middleware/auth');
const { checkPlanLimit } = require('../middleware/planLimits');

router.use(authenticateToken);
router.use(injectMerchantId);
router.use(injectRlsContext);

router.get('/', employeeController.listEmployees);
router.post('/', checkPlanLimit('employees'), employeeController.createEmployee);
router.patch('/:id', employeeController.updateEmployee);
router.delete('/:id', employeeController.deleteEmployee);

module.exports = router;
