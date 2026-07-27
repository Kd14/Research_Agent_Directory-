import { TechDocument } from '../types';

export const INITIAL_DOCUMENTS: TechDocument[] = [
  {
    id: 'doc_1',
    title: 'Transformer-XL Spec & Memory Bandwidth Budget (2026)',
    category: 'Pipeline Spec Sheet',
    fileName: 'transformer_xl_spec_2026.md',
    sizeBytes: 14200,
    uploadedAt: new Date().toISOString(),
    summary: 'Detailed memory layout, context window extension strategy, KV-cache compression algorithms, and GPU VRAM scaling budgets for 70B parameter models.',
    tags: ['KV-Cache', 'VRAM Budget', 'Transformer-XL', 'Context Window', 'FP8'],
    content: `# Transformer-XL Memory Bandwidth & Pipeline Architecture Spec
Version: 3.2.0-Alpha | Target Hardware: 8x H100 SXM5 / H200 Clusters

## Executive Technical Summary
This document specifies the pipeline architecture for scaling context windows up to 1M tokens using dynamic Ring-Attention with KV-cache quantization (INT4/FP8 mix) and Segment Recurrence.

## Key Pipeline Constraints & Specs
- **Parameters**: 70 Billion (Dense Transformer)
- **Attention Type**: Ring Attention with Slided Window & Recurrent Memory Keys
- **Hidden Dim**: 8192 | **Heads**: 64 Query, 8 KV (GQA 8:1 ratio)
- **KV-Cache Size per Token**: 0.25 KB (quantized to FP8)
- **1M Token KV Cache Memory Overhead**: ~256 GB across cluster (~32 GB per GPU)
- **Target Throughput**: 120 tokens/sec decode per stream at 128k context length
- **Peak VRAM Limit**: 76 GB / 80 GB per H100 node

## Memory Bandwidth Calculations
When decoding at 512k tokens context:
1. Memory Bandwidth Bottleneck: $M_{bw} = \\text{Batch Size} \\times \\text{Seq Length} \\times 2 \\times D_{model} \\times N_{layers} \\times \\text{Precision Bytes}$
2. FlashAttention-3 Integration reduces IO pass to HBM3 from $O(N^2)$ to $O(N)$ with SRAM tiling size = 256.
3. Speculative Decoding Spec: Draft model (7B) with acceptance rate $\\alpha = 0.72$ yields $2.8\\times$ decode speedup.

## Identified Risks & Bottlenecks
- All-Reduce collective communication over PCIe Gen5 when scaling past 8 GPUs suffers 35% latency penalty unless NVLink Switch Fabric is engaged.
- KV Cache memory fragmentation during concurrent multi-tenant serving requires PagedAttention allocation with 64-token block granularity.`
  },
  {
    id: 'doc_2',
    title: 'RLHF & Alignment Scaling via Direct Preference Optimization (DPO)',
    category: 'Research Paper',
    fileName: 'rlhf_dpo_scaling_laws.pdf',
    sizeBytes: 28400,
    uploadedAt: new Date(Date.now() - 86400000).toISOString(),
    summary: 'Empirical comparison of PPO vs DPO vs SimPO alignment stability on mathematical reasoning, code execution benchmarks, and reward model over-optimization.',
    tags: ['RLHF', 'DPO', 'Alignment', 'Reward Model', 'Scaling Laws'],
    content: `# Research Paper: Empirical Scaling Limits of Direct Preference Optimization
Authors: AI Research Lab Alignment Team | Date: June 2026

## Abstract
We evaluate the performance boundaries of RLHF vs Direct Preference Optimization (DPO) and Simple Preference Optimization (SimPO) on reasoning tasks. We demonstrate that DPO experiences implicit KL divergence collapse when implicit reward temperature $\\beta < 0.05$, whereas SimPO with length normalization sustains stable preference margins across 50,000 optimization steps.

## Key Empirical Findings
1. **Reward Model Over-Optimization**:
   - PPO suffers from policy drift after 12k gradient steps when KL penalty $\\gamma < 0.1$.
   - DPO retains alignment robustness up to 40k steps but suffers from length-bias amplification (+18% longer responses without accuracy gains).
2. **GSM8K & MATH Benchmark Results**:
   - Baseline Base Model: 64.2%
   - PPO (100k rollout steps): 81.4%
   - DPO ($\\beta=0.1$): 83.1%
   - SimPO ($\\gamma=0.5, \\beta=2.0$): 85.7%
3. **Data Quality Impact**:
   - Filtering out preference pairs with human consensus margin $< 0.15$ yields a $4.2\\times$ improvement in gradient efficiency compared to raw pairwise crowdsourced data.

## Algorithmic Formulation
SimPO loss equation:
$$\\mathcal{L}_{SimPO}(\\theta) = - \\mathbb{E}_{(x, y_w, y_l)} \\left[ \\log \\sigma \\left( \\frac{\\beta}{|y_w|} \\log p_\\theta(y_w|x) - \\frac{\\beta}{|y_l|} \\log p_\\theta(y_l|x) - \\gamma \\right) \\right]$$`
  },
  {
    id: 'doc_3',
    title: 'Distributed Compute v4 Cluster & Pipeline Parallel Topology',
    category: 'Technical Architecture',
    fileName: 'cluster_topology_v4.json',
    sizeBytes: 18900,
    uploadedAt: new Date(Date.now() - 172800000).toISOString(),
    summary: 'Hardware configuration spec for 512-node GPU cluster with 3D Parallelism (TP=8, PP=4, DP=16) and Ray/Megatron-LM orchestration parameters.',
    tags: ['Infrastructure', '3D Parallelism', 'Megatron-LM', 'Cluster Topology', 'Ray'],
    content: `# Cluster Topology & Parallel Execution Configuration Spec
Infrastructure Team | Spec Version 4.1

## Topology Architecture
- **Total Accelerators**: 4,096 GPUs (512 Nodes x 8 GPUs)
- **Interconnect**: 3.2 Tbps InfiniBand NDR per node (Fat-Tree Topology, Non-blocking)
- **Storage Tier**: 2 PB NVMe-oF distributed scratch storage with 400 GB/s aggregate read throughput.

## Parallelism Strategy Matrix
| Dimension | Size | Interconnect Medium | Latency Overhead |
|-----------|------|---------------------|------------------|
| Tensor Parallelism (TP) | 8 | Intra-Node NVLink 900 GB/s | < 2.5 µs |
| Pipeline Parallelism (PP) | 4 | Inter-Node InfiniBand | ~12 µs per bubble stage |
| Data Parallelism (DP/ZeRO-3) | 128 | Overlapped All-Reduce IB | Masked by compute |

## Pipeline Schedule Strategy
1. 1F1B (One Forward, One Backward) interleaved pipeline schedule reduces activation memory peak by 44% compared to naive 1F1B.
2. Gradient Accumulation steps = 32, effective global batch size = 4,096 sequences (4M tokens per optimizer step).
3. Checkpoint frequency: Asynchronous background saves to NVMe-oF every 1,000 steps (~3.2 minutes per checkpoint).`
  },
  {
    id: 'doc_4',
    title: 'FlashAttention-3 Kernel Benchmarks & FP8 MatMul Precision',
    category: 'Benchmark Data',
    fileName: 'flash_attention3_fp8_benchmarks.csv',
    sizeBytes: 9800,
    uploadedAt: new Date(Date.now() - 259200000).toISOString(),
    summary: 'Hardware execution profiling comparing Standard PyTorch SDPA, FlashAttention-2, and FlashAttention-3 in FP16 vs FP8 Tensor Cores.',
    tags: ['FlashAttention-3', 'FP8', 'TFLOPS', 'CUDA Kernels', 'Benchmarks'],
    content: `# FlashAttention-3 & FP8 GEMM Performance Profiling Report

## Benchmark Configuration
- GPU: NVIDIA H100 SXM5 80GB (Hopper Architecture)
- Matrix Sizes: $M=4096, N=4096, K=4096$, Sequence Lengths: 4k, 16k, 64k, 128k, 256k

## Throughput Comparison (TFLOPS per GPU)
- **16k Sequence Length (FP16)**:
  - Standard PyTorch SDPA: 180 TFLOPS (Memory Bound)
  - FlashAttention-2: 640 TFLOPS
  - FlashAttention-3: 840 TFLOPS (73% of Theoretical Peak)
- **64k Sequence Length (FP8 E4M3)**:
  - FlashAttention-2 FP8: 910 TFLOPS
  - FlashAttention-3 FP8 Tensor Core WGMMA: 1,320 TFLOPS (Asynchronous TMA Load)

## Precision & Loss Divergence
- FP8 E4M3 scale factor tuning: dynamic block-wise scaling (block size = 128x128) keeps cosine similarity with FP32 outputs above 0.9984 across 10,000 forward passes.
- Perplexity degradation on Llama-3 70B post FP8 quantization: +0.03 PPL on WikiText-2.`
  }
];
