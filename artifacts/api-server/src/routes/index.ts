import { Router, type IRouter } from "express";
import healthRouter from "./health";
import eWasteRouter from "./e-waste";

const router: IRouter = Router();

router.use(healthRouter);
router.use(eWasteRouter);

export default router;
